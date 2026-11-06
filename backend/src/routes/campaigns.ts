import { Router } from 'express';
import { z } from 'zod';
import { query, queryOne, tx } from '../db.js';
import { ApiError, badRequest, notFound } from '../errors.js';
import { ok, pagination, Where } from '../lib/http.js';
import { acc, auth } from '../middleware/auth.js';
import { credit } from '../services/billing.js';
import { estimate, queueCampaign, unqueueCampaign } from '../services/campaigns.js';
import { enqueueMessages, insertAndCharge, MESSAGE_PUBLIC_COLUMNS } from '../services/messages.js';
import { normalizePhone } from '../lib/phone.js';
import { resolveSenderId } from '../services/senderIds.js';

export const campaignsRouter = Router();
const dash = auth('dashboard');

const STATUSES = ['draft', 'scheduled', 'sending', 'completed', 'failed', 'cancelled'] as const;
const COLS = `id, name, sender_id, body, status, scheduled_at, group_ids, total_recipients, sent_count, delivered_count,
  failed_count, cost_tzs, source, template, created_at, started_at, completed_at`;

const getCampaign = (a: string, id: string) => queryOne<any>(`SELECT ${COLS} FROM campaigns WHERE id = $1 AND account_id = $2`, [id, a]);

async function assertGroups(accountId: string, ids: string[]) {
  if (!ids.length) return;
  const r = await query('SELECT id FROM contact_groups WHERE account_id = $1 AND id = ANY($2::uuid[])', [accountId, ids]);
  if (r.length !== new Set(ids).size) throw notFound('Group');
}

const baseSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sender_id: z.string().trim().max(11).optional().nullable(),
  body: z.string().min(1).max(3000),
  group_ids: z.array(z.string().uuid()),
  scheduled_at: z.coerce.date().optional().nullable(),
});
const createSchema = baseSchema.extend({ group_ids: z.array(z.string().uuid()).default([]) });
// no defaults on PATCH: omitted fields must stay untouched
const patchSchema = baseSchema.partial();

campaignsRouter.post('/campaigns/estimate', dash, async (req, res) => {
  const b = z.object({ group_ids: z.array(z.string().uuid()).min(1), body: z.string().min(1) }).parse(req.body);
  await assertGroups(acc(req), b.group_ids);
  ok(res, await estimate(acc(req), b.group_ids, b.body));
});

campaignsRouter.get('/campaigns', dash, async (req, res) => {
  const f = z.object({ status: z.enum(STATUSES).optional(), q: z.string().optional() }).parse(req.query);
  const { page, per_page, offset, limit } = pagination(req.query);
  const w = new Where().add('account_id = ?', acc(req));
  if (f.status) w.add('status = ?', f.status);
  if (f.q) w.add('name ILIKE ?', `%${f.q}%`);
  const total = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM campaigns ${w.sql}`, w.params);
  const rows = await query(`SELECT ${COLS} FROM campaigns ${w.sql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, w.params);
  ok(res, rows, 200, { page, per_page, total: total?.n ?? 0 });
});

campaignsRouter.post('/campaigns', dash, async (req, res) => {
  const b = createSchema.parse(req.body);
  const a = acc(req);
  await assertGroups(a, b.group_ids);
  const senderId = await resolveSenderId(a, b.sender_id);
  const r = await queryOne<{ id: string }>(
    `INSERT INTO campaigns (account_id, name, sender_id, body, group_ids, scheduled_at, status)
     VALUES ($1, $2, $3, $4, $5::uuid[], $6, 'draft') RETURNING id`,
    [a, b.name, senderId, b.body, b.group_ids, b.scheduled_at ?? null],
  );
  ok(res, await getCampaign(a, r!.id), 201);
});

campaignsRouter.get('/campaigns/:id', dash, async (req: any, res) => {
  const c = await getCampaign(acc(req), req.params.id);
  if (!c) throw notFound('Campaign');
  const breakdown = await query<{ status: string; n: number }>(
    'SELECT status, count(*)::int AS n FROM messages WHERE campaign_id = $1 GROUP BY status',
    [c.id],
  );
  const by_status = Object.fromEntries(['queued', 'sent', 'delivered', 'failed', 'rejected'].map((s) => [s, 0]));
  for (const b of breakdown) by_status[b.status] = b.n;
  ok(res, { ...c, by_status });
});

const patchCampaign = async (req: any, res: any) => {
  const b = patchSchema.parse(req.body);
  const a = acc(req);
  const c = await getCampaign(a, req.params.id);
  if (!c) throw notFound('Campaign');
  if (!['draft', 'scheduled'].includes(c.status))
    throw new ApiError(409, 'conflict', `Cannot edit a campaign that is ${c.status}`);
  if (b.group_ids) await assertGroups(a, b.group_ids);
  const sender = b.sender_id !== undefined ? await resolveSenderId(a, b.sender_id) : c.sender_id;
  await query(
    `UPDATE campaigns SET name = $3, sender_id = $4, body = $5, group_ids = $6::uuid[], scheduled_at = $7
     WHERE id = $1 AND account_id = $2`,
    [c.id, a, b.name ?? c.name, sender, b.body ?? c.body, b.group_ids ?? c.group_ids,
      b.scheduled_at !== undefined ? b.scheduled_at : c.scheduled_at],
  );
  const updated = await getCampaign(a, c.id);
  if (updated.status === 'scheduled') {
    // re-time the delayed job
    await queueCampaign(c.id, updated.scheduled_at ? new Date(updated.scheduled_at) : null);
  }
  ok(res, updated);
};
campaignsRouter.patch('/campaigns/:id', dash, patchCampaign);
campaignsRouter.put('/campaigns/:id', dash, patchCampaign);

campaignsRouter.delete('/campaigns/:id', dash, async (req: any, res) => {
  const a = acc(req);
  const c = await getCampaign(a, req.params.id);
  if (!c) throw notFound('Campaign');
  if (c.status === 'sending') throw new ApiError(409, 'conflict', 'Cancel the campaign before deleting it while it is sending');
  await unqueueCampaign(c.id);
  await query('DELETE FROM campaigns WHERE id = $1 AND account_id = $2', [c.id, a]);
  res.status(204).end();
});

campaignsRouter.post('/campaigns/:id/send', dash, async (req: any, res) => {
  const b = z.object({ scheduled_at: z.coerce.date().optional().nullable() }).parse(req.body ?? {});
  const a = acc(req);
  const c = await getCampaign(a, req.params.id);
  if (!c) throw notFound('Campaign');
  if (!['draft', 'scheduled'].includes(c.status)) throw new ApiError(409, 'conflict', `Campaign is already ${c.status}`);
  if (!c.group_ids?.length) throw badRequest('Campaign has no audience groups');

  const at = b.scheduled_at !== undefined ? b.scheduled_at : c.scheduled_at ? new Date(c.scheduled_at) : null;
  const future = at && at.getTime() > Date.now() + 5000;

  // Pre-flight balance check (the actual charge happens atomically on dispatch)
  const est = await estimate(a, c.group_ids, c.body);
  if (!est.recipients) throw badRequest('Selected groups have no (opted-in) contacts');
  const bal = await queryOne<{ balance_tzs: number }>('SELECT balance_tzs FROM accounts WHERE id = $1', [a]);
  if (!future && (bal?.balance_tzs ?? 0) < est.cost_tzs) {
    throw new ApiError(402, 'insufficient_balance', `Insufficient balance: need TZS ${est.cost_tzs}, have TZS ${bal?.balance_tzs ?? 0}`, {
      required_tzs: est.cost_tzs,
      balance_tzs: bal?.balance_tzs ?? 0,
    });
  }
  await query(`UPDATE campaigns SET status = $3, scheduled_at = $4, total_recipients = $5 WHERE id = $1 AND account_id = $2`, [
    c.id,
    a,
    future ? 'scheduled' : 'sending',
    future ? at : c.scheduled_at,
    est.recipients,
  ]);
  if (!future) await query('UPDATE campaigns SET started_at = now() WHERE id = $1', [c.id]);
  await queueCampaign(c.id, future ? at : null);
  ok(res, { ...(await getCampaign(a, c.id)), estimate: est }, 202);
});

campaignsRouter.post('/campaigns/:id/cancel', dash, async (req: any, res) => {
  const a = acc(req);
  const c = await getCampaign(a, req.params.id);
  if (!c) throw notFound('Campaign');
  if (!['draft', 'scheduled', 'sending'].includes(c.status)) throw new ApiError(409, 'conflict', `Campaign is already ${c.status}`);
  await unqueueCampaign(c.id);
  // Refund messages that haven't left yet
  const refunded = await tx(async (client) => {
    await client.query(`SELECT 1 FROM campaigns WHERE id = $1 FOR UPDATE`, [c.id]);
    const r = await client.query<{ id: string; cost_tzs: number }>(
      `UPDATE messages SET status = 'rejected', error_code = 'cancelled', refunded = true
       WHERE campaign_id = $1 AND status = 'queued' AND refunded = false RETURNING id, cost_tzs`,
      [c.id],
    );
    const amount = r.rows.reduce((s, m) => s + Number(m.cost_tzs), 0);
    if (amount > 0) await credit(client, a, amount, 'refund', `Refund: campaign "${c.name}" cancelled (${r.rows.length} msgs)`, c.id);
    await client.query(
      `UPDATE campaigns SET status = 'cancelled', completed_at = now(), failed_count = failed_count + $2,
         cost_tzs = GREATEST(cost_tzs - $3, 0) WHERE id = $1`,
      [c.id, r.rows.length, amount],
    );
    return { count: r.rows.length, amount };
  });
  ok(res, { ...(await getCampaign(a, c.id)), refunded_messages: refunded.count, refunded_tzs: refunded.amount });
});

campaignsRouter.get('/campaigns/:id/messages', dash, async (req: any, res) => {
  const a = acc(req);
  const c = await getCampaign(a, req.params.id);
  if (!c) throw notFound('Campaign');
  const f = z.object({ status: z.enum(['queued', 'sent', 'delivered', 'failed', 'rejected']).optional(), q: z.string().optional() }).parse(req.query);
  const { page, per_page, offset, limit } = pagination(req.query);
  const w = new Where().add('account_id = ?', a).add('campaign_id = ?', c.id);
  if (f.status) w.add('status = ?', f.status);
  if (f.q) w.add('(to_phone ILIKE ? OR row_ref = ?)', `%${f.q}%`, f.q);
  const total = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM messages ${w.sql}`, w.params);
  const rows = await query(`SELECT ${MESSAGE_PUBLIC_COLUMNS} FROM messages ${w.sql} ORDER BY created_at, id LIMIT ${limit} OFFSET ${offset}`, w.params);
  ok(res, rows, 200, { page, per_page, total: total?.n ?? 0 });
});

/* ---------------------------------------------------------------- Send from Excel */

const fileRowSchema = z.object({
  to: z.string().min(1).max(40),
  message: z.string().min(1, 'message is required').max(1530),
  ref: z.string().max(60).optional().nullable(),
  /** other columns of the row, only used when save_contacts is set */
  fields: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
});
const fromFileSchema = z.object({
  name: z.string().trim().min(1).max(160),
  sender_id: z.string().trim().max(11).optional().nullable(),
  template: z.string().min(1).max(3000),
  rows: z.array(fileRowSchema).min(1, 'rows must not be empty').max(10_000, 'Maximum 10,000 rows per send'),
  save_contacts: z
    .object({
      group_name: z.string().trim().min(1).max(120),
      name_column: z.string().trim().max(120).optional().nullable(),
    })
    .optional()
    .nullable(),
});

const fieldKey = (k: string) => k.trim().replace(/\s+/g, ' ').slice(0, 80);

function splitName(full: string | null | undefined): { first: string | null; last: string | null } {
  const parts = String(full ?? '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { first: null, last: null };
  const cap = (s: string) => (s === s.toUpperCase() ? s.charAt(0) + s.slice(1).toLowerCase() : s);
  return { first: cap(parts[0]), last: parts.length > 1 ? parts.slice(1).map(cap).join(' ') : null };
}

/**
 * Create and send a campaign from pre-rendered rows (Send from Excel).
 * Phones are validated here; messages are sent exactly as given. Charged in one transaction.
 */
campaignsRouter.post('/campaigns/from-file', dash, async (req, res) => {
  const b = fromFileSchema.parse(req.body);
  const a = acc(req);

  const invalid: { index: number; ref: string | null; to: string }[] = [];
  const rows = b.rows.map((r, index) => {
    const phone = normalizePhone(r.to);
    if (!phone) invalid.push({ index, ref: r.ref ?? null, to: r.to });
    return { ...r, phone: phone ?? '', index };
  });
  if (invalid.length) throw badRequest(`${invalid.length} row(s) have an invalid phone number`, { invalid: invalid.slice(0, 200) });

  const senderId = await resolveSenderId(a, b.sender_id);
  const opted = await query<{ phone: string }>(
    'SELECT phone FROM contacts WHERE account_id = $1 AND phone = ANY($2) AND opted_out = true',
    [a, [...new Set(rows.map((r) => r.phone))]],
  );
  const optedSet = new Set(opted.map((o) => o.phone));
  const targets = rows.filter((r) => !optedSet.has(r.phone));
  if (!targets.length) throw badRequest('Every number in this file has opted out (replied STOP)', { opted_out: [...optedSet] });

  const result = await tx(async (client) => {
    // 1. optional: save numbers to contacts + group
    let group: { id: string; name: string } | null = null;
    const contactIds = new Map<string, string>();
    let saved = { created: 0, updated: 0 };
    if (b.save_contacts) {
      const g = await client.query<{ id: string; name: string }>(
        'SELECT id, name FROM contact_groups WHERE account_id = $1 AND lower(name) = lower($2) ORDER BY created_at LIMIT 1',
        [a, b.save_contacts.group_name],
      );
      group = g.rows[0] ?? (await client.query<{ id: string; name: string }>(
        `INSERT INTO contact_groups (account_id, name, description) VALUES ($1, $2, 'Saved from Send from Excel') RETURNING id, name`,
        [a, b.save_contacts.group_name],
      )).rows[0];
      const nameCol = b.save_contacts.name_column ? b.save_contacts.name_column.trim().toLowerCase() : null;
      const byPhone = new Map<string, { phone: string; first_name: string | null; last_name: string | null; fields: Record<string, string> }>();
      for (const r of rows) {
        const fields: Record<string, string> = {};
        let name: string | null = null;
        for (const [k, v] of Object.entries(r.fields ?? {})) {
          if (v === null || v === undefined || String(v).trim() === '') continue;
          if (nameCol && k.trim().toLowerCase() === nameCol) name = String(v);
          else fields[fieldKey(k)] = String(v).trim().slice(0, 500);
        }
        if (r.ref) fields.row = r.ref;
        const { first, last } = splitName(name);
        byPhone.set(r.phone, { phone: r.phone, first_name: first, last_name: last, fields }); // last row for a phone wins
      }
      const entries = [...byPhone.values()];
      for (let i = 0; i < entries.length; i += 1000) {
        const up = await client.query<{ id: string; phone: string; inserted: boolean }>(
          `INSERT INTO contacts (account_id, phone, first_name, last_name, fields)
           SELECT $1, x.phone, x.first_name, x.last_name, x.fields
           FROM jsonb_to_recordset($2::jsonb) AS x(phone text, first_name text, last_name text, fields jsonb)
           ON CONFLICT (account_id, phone) DO UPDATE SET
             first_name = COALESCE(EXCLUDED.first_name, contacts.first_name),
             last_name = COALESCE(EXCLUDED.last_name, contacts.last_name),
             fields = contacts.fields || EXCLUDED.fields
           RETURNING id, phone, (xmax = 0) AS inserted`,
          [a, JSON.stringify(entries.slice(i, i + 1000))],
        );
        for (const row of up.rows) {
          contactIds.set(row.phone, row.id);
          row.inserted ? saved.created++ : saved.updated++;
        }
        await client.query(
          'INSERT INTO contact_group_members (group_id, contact_id) SELECT $1, unnest($2::uuid[]) ON CONFLICT DO NOTHING',
          [group.id, up.rows.map((x) => x.id)],
        );
      }
    } else {
      const known = await client.query<{ id: string; phone: string }>('SELECT id, phone FROM contacts WHERE account_id = $1 AND phone = ANY($2)', [
        a,
        [...new Set(targets.map((t) => t.phone))],
      ]);
      for (const k of known.rows) contactIds.set(k.phone, k.id);
    }

    // 2. campaign + messages + one charge
    const c = await client.query<{ id: string }>(
      `INSERT INTO campaigns (account_id, name, sender_id, body, template, source, group_ids, status, started_at, total_recipients)
       VALUES ($1, $2, $3, $4, $4, 'file', $5::uuid[], 'sending', now(), $6) RETURNING id`,
      [a, b.name, senderId, b.template, group ? [group.id] : [], targets.length],
    );
    const campaignId = c.rows[0].id;
    const msgs = await insertAndCharge(
      client,
      targets.map((t) => ({ to: t.phone, body: t.message, contactId: contactIds.get(t.phone) ?? null, rowRef: t.ref ?? String(t.index + 1) })),
      { accountId: a, senderId, campaignId, description: `Send from Excel "${b.name}" (${targets.length} messages)` },
    );
    const cost = msgs.reduce((s, m) => s + Number(m.cost_tzs), 0);
    await client.query('UPDATE campaigns SET cost_tzs = $2 WHERE id = $1', [campaignId, Math.round(cost * 100) / 100]);
    return { campaignId, msgs, cost, group, saved };
  });

  await enqueueMessages(result.msgs.map((m) => m.id));
  const segments = result.msgs.reduce((s, m) => s + m.segments, 0);
  ok(
    res,
    {
      ...(await getCampaign(a, result.campaignId)),
      messages: result.msgs.length,
      segments,
      total_cost_tzs: Math.round(result.cost * 100) / 100,
      ...(optedSet.size ? { opted_out: [...optedSet] } : {}),
      ...(result.group
        ? { contacts: { group_id: result.group.id, group_name: result.group.name, created: result.saved.created, updated: result.saved.updated } }
        : {}),
    },
    202,
  );
});
