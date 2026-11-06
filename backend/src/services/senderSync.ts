/**
 * Sender names live on Bermi's single Textify account. A customer's request is forwarded to
 * POST /sender-names; the Textify admin approves or declines it. syncSenderNames() pulls
 * GET /sender-names (every TEXTIFY_SENDER_SYNC_MS, or "Sync now" in the admin page) and updates
 * statuses. A customer can only use names approved on THEIR Bermi account (resolveSenderId).
 */
import { query, queryOne } from '../db.js';
import { logger } from '../logger.js';
import { redis } from '../redis.js';
import { rowsOf, TextifyApiError, textifyApi, type TextifySenderName } from '../upstream/textify.js';

const log = logger.child({ mod: 'sender-sync' });
export const SENDER_SYNC_KEY = 'bermi:textify:sender_sync';
export const NEEDS_REVIEW = 'This name already exists on the Textify account. An admin must check who owns it and approve or reject.';

const mapStatus = (s: string) => (s === 'approved' ? 'approved' : s === 'declined' ? 'rejected' : 'pending');

export function senderReason(purpose: string | null, sample: string | null, accountName: string) {
  return [`Bermi Connect customer: ${accountName}.`, purpose?.trim(), sample?.trim() ? `Sample message: ${sample.trim()}` : null]
    .filter(Boolean).join(' ').slice(0, 1000);
}

/** Forward one request to Textify. Never throws; records sync_error instead. */
export async function registerUpstream(senderRowId: string): Promise<void> {
  const api = textifyApi();
  if (!api) return;
  const row = await queryOne<{ id: string; name: string; purpose: string | null; sample_message: string | null; account_name: string }>(
    `SELECT s.id, s.name, s.purpose, s.sample_message, a.name AS account_name FROM sender_ids s JOIN accounts a ON a.id = s.account_id WHERE s.id = $1`,
    [senderRowId],
  );
  if (!row) return;
  try {
    const created = await api.createSenderName({ name: row.name, reason: senderReason(row.purpose, row.sample_message, row.account_name) });
    let up: TextifySenderName | undefined = created ?? undefined;
    if (!up?.id) up = rowsOf(await api.listSenderNames()).find((x) => x.name.toUpperCase() === row.name.toUpperCase());
    await query(`UPDATE sender_ids SET textify_sender_id = $2, textify_status = $3, synced_at = now(), sync_error = NULL WHERE id = $1`, [
      row.id, up?.id ?? null, up?.status ?? 'requested',
    ]);
  } catch (e) {
    // Already on Bermi's Textify account (an earlier request, another customer, or made in the portal)?
    // Never auto-link: that could hand one customer a name approved for someone else. An admin reviews it.
    if (e instanceof TextifyApiError && e.status === 400 && /exist|taken|duplicate/i.test(e.message)) {
      await query('UPDATE sender_ids SET sync_error = $2, synced_at = now() WHERE id = $1', [row.id, NEEDS_REVIEW]);
      return;
    }
    const msg = e instanceof TextifyApiError ? `${e.code}: ${e.message}` : String(e);
    log.warn({ sender: row.name, err: msg }, 'sender name request to Textify failed');
    await query('UPDATE sender_ids SET sync_error = $2, synced_at = now() WHERE id = $1', [row.id, msg.slice(0, 300)]);
  }
}

export interface SenderSyncResult { at: string; ok: boolean; upstream: number; updated: number; registered: number; error?: string }

export async function syncSenderNames(): Promise<SenderSyncResult> {
  const api = textifyApi();
  const at = new Date().toISOString();
  if (!api) {
    const r = { at, ok: false, upstream: 0, updated: 0, registered: 0, error: 'TEXTIFY_API_KEY not set' };
    await redis.set(SENDER_SYNC_KEY, JSON.stringify(r)).catch(() => {});
    return r;
  }
  let result: SenderSyncResult;
  try {
    const upstream: TextifySenderName[] = [];
    for (let page = 1; page <= 20; page++) {
      const d = await api.listSenderNames({ page, limit: 1000 });
      const rows = rowsOf(d);
      upstream.push(...rows);
      if (Array.isArray(d) || !rows.length || page >= (d?.total_pages ?? 1)) break;
    }
    const byId = new Map(upstream.map((u) => [String(u.id), u]));
    let updated = 0;
    const local = await query<{ id: string; textify_sender_id: string | null; status: string; textify_status: string | null }>(
      `SELECT id, textify_sender_id, status, textify_status FROM sender_ids WHERE textify_sender_id IS NOT NULL`,
    );
    for (const l of local) {
      const u = byId.get(String(l.textify_sender_id));
      if (!u) continue;
      const status = mapStatus(u.status);
      if (status !== l.status || u.status !== l.textify_status) updated++;
      await query(`UPDATE sender_ids SET status = $2, textify_status = $3, synced_at = now(), sync_error = NULL WHERE id = $1`, [l.id, status, u.status]);
    }
    // retry requests that never reached Textify (e.g. it was down)
    const unsent = await query<{ id: string }>(`SELECT id FROM sender_ids WHERE textify_sender_id IS NULL AND status = 'pending' AND (sync_error IS NULL OR sync_error <> $1) ORDER BY created_at LIMIT 50`, [NEEDS_REVIEW]);
    for (const u of unsent) await registerUpstream(u.id);
    result = { at, ok: true, upstream: upstream.length, updated, registered: unsent.length };
  } catch (e) {
    result = { at, ok: false, upstream: 0, updated: 0, registered: 0, error: e instanceof Error ? e.message : String(e) };
    log.warn({ err: result.error }, 'sender sync failed');
  }
  await redis.set(SENDER_SYNC_KEY, JSON.stringify(result)).catch(() => {});
  return result;
}

export async function lastSenderSync(): Promise<SenderSyncResult | null> {
  const v = await redis.get(SENDER_SYNC_KEY).catch(() => null);
  return v ? JSON.parse(v) : null;
}
