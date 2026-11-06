import crypto from 'node:crypto';
import type { PoolClient } from 'pg';
import { config } from '../config.js';
import { pool, query, queryOne, tx } from '../db.js';
import { cleanText, countSegments } from '../lib/segments.js';
import { logger } from '../logger.js';
import { smsQueue } from '../queues.js';
import { charge, credit, round2 } from './billing.js';
import { dispatchEvent } from './webhooks.js';

export const MESSAGE_PUBLIC_COLUMNS = `id, campaign_id, batch_id, to_phone AS "to", to_phone, sender_id, body, segments, encoding, status,
  provider_message_id, error_code, cost_tzs, reference, row_ref, test_mode, scheduled_at, created_at, sent_at, delivered_at`;

export interface NewMessage {
  to: string;
  body: string;
  contactId?: string | null;
  /** original spreadsheet row reference (Send from Excel) */
  rowRef?: string | null;
}

export interface CreateOptions {
  accountId: string;
  senderId: string;
  apiKeyId?: string | null;
  campaignId?: string | null;
  batchId?: string;
  reference?: string | null;
  testMode?: boolean;
  scheduleAt?: Date | null;
  description: string;
}

export interface CreatedMessage {
  id: string;
  to: string;
  status: string;
  segments: number;
  encoding: string;
  cost_tzs: number;
}

export const priceFor = (segments: number) => round2(segments * config.smsPriceTzs);

/**
 * Insert messages + charge balance atomically (within the given client/transaction).
 * Test mode: no charge, cost 0. Does NOT enqueue; call enqueueMessages after commit.
 */
export async function insertAndCharge(client: PoolClient, items: NewMessage[], o: CreateOptions): Promise<CreatedMessage[]> {
  const batchId = o.batchId ?? crypto.randomUUID();
  const rows = items.map((m) => {
    // store exactly what will be delivered (Textify removes non-ASCII; we transliterate first)
    const body = cleanText(m.body);
    const seg = countSegments(body);
    return { ...m, body, segments: seg.segments, encoding: seg.encoding, cost: o.testMode ? 0 : priceFor(seg.segments) };
  });
  const total = round2(rows.reduce((s, r) => s + r.cost, 0));
  if (!o.testMode && total > 0) await charge(client, o.accountId, total, o.description, o.campaignId ?? batchId);

  const out: CreatedMessage[] = [];
  // insert in chunks to keep parameter counts sane
  const CHUNK = 500;
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    const vals: unknown[] = [];
    const tuples = chunk.map((r) => {
      const base = vals.length;
      vals.push(o.accountId, o.campaignId ?? null, o.apiKeyId ?? null, batchId, r.contactId ?? null, r.to, o.senderId, r.body,
        r.segments, r.encoding, !!o.testMode, r.cost, o.reference ?? null, o.scheduleAt ?? null, r.rowRef ?? null);
      return `(${Array.from({ length: 15 }, (_, k) => `$${base + k + 1}`).join(',')})`;
    });
    const res = await client.query<CreatedMessage>(
      `INSERT INTO messages (account_id, campaign_id, api_key_id, batch_id, contact_id, to_phone, sender_id, body,
         segments, encoding, test_mode, cost_tzs, reference, scheduled_at, row_ref)
       VALUES ${tuples.join(',')}
       RETURNING id, to_phone AS "to", to_phone, status, segments, encoding, cost_tzs`,
      vals,
    );
    out.push(...res.rows);
  }
  return out;
}

/** Push sms-send jobs (optionally delayed). jobId = message id → idempotent. */
export async function enqueueMessages(ids: string[], delayMs = 0) {
  const q = smsQueue();
  const CHUNK = 1000;
  for (let i = 0; i < ids.length; i += CHUNK) {
    await q.addBulk(
      ids.slice(i, i + CHUNK).map((id) => ({
        name: 'send',
        data: { messageId: id },
        opts: { jobId: id, delay: Math.max(0, delayMs) },
      })),
    );
  }
}

/** Convenience: create + charge in its own transaction, then enqueue. */
export async function createMessages(items: NewMessage[], o: CreateOptions) {
  const created = await tx((c) => insertAndCharge(c, items, o));
  const delay = o.scheduleAt ? o.scheduleAt.getTime() - Date.now() : 0;
  await enqueueMessages(created.map((m) => m.id), delay);
  return created;
}

/* ------------------------------------------------------------------ status transitions */

const FINAL = ['delivered', 'failed', 'rejected'];

export interface MessageRow {
  id: string;
  account_id: string;
  campaign_id: string | null;
  to_phone: string;
  sender_id: string;
  body: string;
  segments: number;
  encoding: 'GSM7' | 'UCS2';
  status: string;
  test_mode: boolean;
  cost_tzs: number;
  refunded: boolean;
  provider_message_id: string | null;
  reference: string | null;
}

export async function getMessage(id: string): Promise<MessageRow | null> {
  return queryOne<MessageRow>('SELECT * FROM messages WHERE id = $1', [id]);
}

/** Mark sent after provider accepted; record part ids. */
export async function markSent(messageId: string, providerIds: string[]) {
  await tx(async (c) => {
    const r = await c.query(
      `UPDATE messages SET status = 'sent', provider_message_id = $2, sent_at = now()
       WHERE id = $1 AND status = 'queued' RETURNING campaign_id`,
      [messageId, providerIds[0] ?? null],
    );
    for (let i = 0; i < providerIds.length; i++) {
      await c.query(
        `INSERT INTO message_parts (provider_message_id, message_id, part_no) VALUES ($1, $2, $3)
         ON CONFLICT (provider_message_id) DO NOTHING`,
        [providerIds[i], messageId, i + 1],
      );
    }
    const campaignId = r.rows[0]?.campaign_id;
    if (campaignId) await c.query('UPDATE campaigns SET sent_count = sent_count + 1 WHERE id = $1', [campaignId]);
  });
}

/**
 * Move a message into a final state. Refunds failed/rejected (once). Updates campaign counters,
 * fires webhooks and completes the campaign when all its messages are final.
 */
export async function finalizeMessage(messageId: string, status: 'delivered' | 'failed' | 'rejected', errorCode: string | null = null) {
  const result = await tx(async (c) => {
    const r = await c.query<MessageRow & { prev_status: string }>(
      `SELECT * FROM messages WHERE id = $1 FOR UPDATE`,
      [messageId],
    );
    const m = r.rows[0];
    if (!m || FINAL.includes(m.status)) return null;
    const wasSent = m.status === 'sent';
    await c.query(
      `UPDATE messages SET status = $2, error_code = $3,
         delivered_at = CASE WHEN $2 = 'delivered' THEN now() ELSE delivered_at END,
         sent_at = COALESCE(sent_at, CASE WHEN $2 = 'delivered' THEN now() END)
       WHERE id = $1`,
      [messageId, status, errorCode],
    );
    if (status !== 'delivered' && !m.test_mode && Number(m.cost_tzs) > 0 && !m.refunded) {
      await credit(c, m.account_id, Number(m.cost_tzs), 'refund', `Refund: message to ${m.to_phone} ${status}`, m.id);
      await c.query('UPDATE messages SET refunded = true WHERE id = $1', [m.id]);
      if (m.campaign_id) await c.query('UPDATE campaigns SET cost_tzs = GREATEST(cost_tzs - $2, 0) WHERE id = $1', [m.campaign_id, m.cost_tzs]);
    }
    if (m.campaign_id) {
      if (status === 'delivered') {
        await c.query(`UPDATE campaigns SET delivered_count = delivered_count + 1, sent_count = sent_count + $2 WHERE id = $1`, [
          m.campaign_id,
          wasSent ? 0 : 1,
        ]);
      } else {
        await c.query('UPDATE campaigns SET failed_count = failed_count + 1 WHERE id = $1', [m.campaign_id]);
      }
    }
    return m;
  });
  if (!result) return;
  const fresh = await queryOne(`SELECT ${MESSAGE_PUBLIC_COLUMNS} FROM messages WHERE id = $1`, [messageId]);
  await dispatchEvent(result.account_id, status === 'delivered' ? 'message.delivered' : 'message.failed', fresh).catch((err) =>
    logger.error({ err }, 'webhook dispatch failed'),
  );
  if (result.campaign_id) await maybeCompleteCampaign(result.campaign_id);
}

/** Campaign done when status=sending and no messages remain queued/sent. */
export async function maybeCompleteCampaign(campaignId: string) {
  const row = await queryOne<{ account_id: string; id: string }>(
    `UPDATE campaigns c SET status = 'completed', completed_at = now()
     WHERE c.id = $1 AND c.status = 'sending'
       AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.campaign_id = c.id AND m.status IN ('queued','sent'))
     RETURNING c.*`,
    [campaignId],
  );
  if (row) {
    await dispatchEvent(row.account_id, 'campaign.completed', row).catch((err) => logger.error({ err }, 'webhook dispatch failed'));
  }
}

/**
 * Safety net for lost DLRs: complete 'sending' campaigns that have nothing queued and whose
 * remaining 'sent' messages are older than `hours`. Messages themselves stay 'sent' (unknown).
 */
export async function sweepStaleCampaigns(hours = 72) {
  const rows = await query<{ id: string; account_id: string }>(
    `UPDATE campaigns c SET status = 'completed', completed_at = now()
     WHERE c.status = 'sending'
       AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.campaign_id = c.id AND m.status = 'queued')
       AND NOT EXISTS (SELECT 1 FROM messages m WHERE m.campaign_id = c.id AND m.status = 'sent'
                       AND m.sent_at > now() - make_interval(hours => $1))
       AND c.started_at < now() - make_interval(hours => $1)
     RETURNING c.*`,
    [hours],
  );
  for (const r of rows) await dispatchEvent(r.account_id, 'campaign.completed', r).catch(() => {});
  return rows.length;
}

/* ------------------------------------------------------------------ delivery receipts */

const DLR_MAP: Record<string, 'delivered' | 'failed' | 'rejected' | null> = {
  DELIVRD: 'delivered',
  UNDELIV: 'failed',
  EXPIRED: 'failed',
  DELETED: 'failed',
  REJECTD: 'failed',
  UNKNOWN: 'failed',
  ACCEPTD: null,
  ENROUTE: null,
};

export { parseReceipt } from '../lib/dlr.js';

/**
 * Apply a DLR for one provider part id. A multi-part message is delivered when all parts are
 * delivered, failed as soon as any part fails.
 */
export async function applyReceipt(providerMessageId: string, stat: string, err: string | null) {
  const mapped = DLR_MAP[stat] ?? 'failed';
  if (mapped === null) return;
  const part = await queryOne<{ message_id: string }>(
    `UPDATE message_parts SET status = $2, updated_at = now() WHERE provider_message_id = $1 RETURNING message_id`,
    [providerMessageId, mapped],
  );
  let messageId = part?.message_id;
  if (!messageId) {
    // provider may have sent DLR before we recorded parts, or a single-id provider
    const m = await queryOne<{ id: string }>('SELECT id FROM messages WHERE provider_message_id = $1', [providerMessageId]);
    if (!m) {
      logger.warn({ providerMessageId, stat }, 'DLR for unknown message');
      return false;
    }
    messageId = m.id;
  }
  if (mapped !== 'delivered') {
    await finalizeMessage(messageId, mapped, err && err !== '000' ? `${stat}:${err}` : stat);
    return true;
  }
  const pending = await queryOne<{ n: number }>(
    `SELECT count(*)::int AS n FROM message_parts WHERE message_id = $1 AND status <> 'delivered'`,
    [messageId],
  );
  if (!pending || pending.n === 0) await finalizeMessage(messageId, 'delivered');
  return true;
}

/* ------------------------------------------------------------------ inbound */

export async function handleInbound(fromRaw: string, to: string | null, body: string) {
  const { normalizePhone } = await import('../lib/phone.js');
  const from = normalizePhone(fromRaw) ?? (fromRaw.startsWith('+') ? fromRaw : `+${fromRaw}`);
  const text = body.trim();
  // Attribute to the account that last messaged this number
  const last = await queryOne<{ account_id: string }>(
    `SELECT account_id FROM messages WHERE to_phone = $1 ORDER BY created_at DESC LIMIT 1`,
    [from],
  );
  const accountId = last?.account_id ?? null;
  const inbound = await queryOne(
    `INSERT INTO inbound_messages (account_id, from_phone, "to", body) VALUES ($1, $2, $3, $4)
     RETURNING id, account_id, from_phone AS "from", "to", body, received_at`,
    [accountId, from, to, text],
  );
  let optedOut = false;
  if (/^(STOP|STOPALL|UNSUBSCRIBE|CANCEL|END|QUIT|ACHA|SITISHA)\b/i.test(text)) {
    const r = await pool.query('UPDATE contacts SET opted_out = true WHERE phone = $1', [from]);
    optedOut = true;
    logger.info({ from, contacts: r.rowCount }, 'STOP received → opted out');
  }
  // fire to every account that has this contact (or the last-sender account)
  const accounts = await query<{ account_id: string }>(
    `SELECT DISTINCT account_id FROM contacts WHERE phone = $1
     UNION SELECT $2::uuid WHERE $2::uuid IS NOT NULL`,
    [from, accountId],
  );
  for (const a of accounts) {
    await dispatchEvent(a.account_id, 'message.inbound', { ...inbound, opted_out: optedOut }).catch(() => {});
  }
  return { inbound, optedOut };
}
