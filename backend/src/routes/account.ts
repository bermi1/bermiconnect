import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { query, queryOne, tx } from '../db.js';
import { ApiError, badRequest, conflict, forbidden, notFound } from '../errors.js';
import { hmacSha256, randomToken, safeEqual, sha256 } from '../lib/crypto.js';
import { ok, pagination, Where } from '../lib/http.js';
import { normalizePhone } from '../lib/phone.js';
import { acc, auth, requireAdmin } from '../middleware/auth.js';
import { getPaymentProvider, PAYMENT_METHODS } from '../payments/index.js';
import { confirmPayment, createPayment, getPayment, listPayments, MIN_SMS, priceTiers, quote } from '../services/payments.js';
import { lastSenderSync, registerUpstream, syncSenderNames } from '../services/senderSync.js';
import { textifyApi } from '../upstream/textify.js';
import { redis, SMPP_STATUS_KEY } from '../redis.js';
import { credit } from '../services/billing.js';
import { buildPayload, deliver, WEBHOOK_EVENTS } from '../services/webhooks.js';

export const accountRouter = Router();
const dash = auth('dashboard');
const jwtOnly = auth('jwt');

/* ---------------------------------------------------------------- sender IDs */

const SENDER_COLS = 'id, name, purpose, sample_message, status, textify_status, synced_at, created_at';
const senderSchema = z.object({
  name: z
    .string()
    .trim()
    .min(3, 'Sender ID must be 3–11 characters')
    .max(11, 'Sender ID must be 3–11 characters')
    .regex(/^[A-Za-z0-9 .\-&]+$/, 'Only letters, digits, space, dot, dash and & are allowed')
    .regex(/[A-Za-z]/, 'Sender ID must contain at least one letter'),
  purpose: z.string().trim().max(500).optional().nullable(),
  /** an example of what will be sent; operators ask for it */
  sample_message: z.string().trim().max(480).optional().nullable(),
});

accountRouter.get('/sender-ids', dash, async (req, res) => {
  const { status } = z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() }).parse(req.query);
  const { page, per_page, offset, limit } = pagination(req.query);
  const w = new Where().add('account_id = ?', acc(req));
  if (status) w.add('status = ?', status);
  const total = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM sender_ids ${w.sql}`, w.params);
  const rows = await query(`SELECT ${SENDER_COLS} FROM sender_ids ${w.sql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, w.params);
  ok(res, rows, 200, { page, per_page, total: total?.n ?? 0, default_sender_id: config.defaultSenderId });
});

accountRouter.get('/sender-ids/:id', dash, async (req, res) => {
  const s = await queryOne(`SELECT ${SENDER_COLS} FROM sender_ids WHERE id = $1 AND account_id = $2`, [req.params.id, acc(req)]);
  if (!s) throw notFound('Sender ID');
  ok(res, s);
});

accountRouter.post('/sender-ids', dash, async (req, res) => {
  const b = senderSchema.parse(req.body);
  if (b.name.toUpperCase() === config.defaultSenderId.toUpperCase()) throw conflict(`${config.defaultSenderId} is always available`);
  const name = b.name.toUpperCase();
  const s = await queryOne<{ id: string }>(
    `INSERT INTO sender_ids (account_id, name, purpose, sample_message) VALUES ($1, $2, $3, $4) RETURNING id`,
    [acc(req), name, b.purpose ?? null, b.sample_message ?? null],
  ).catch((e) => {
    if (e?.code === '23505') throw conflict(`Sender ID "${name}" was already requested`);
    throw e;
  });
  // Forward to Bermi's Textify account (reviewed there; status comes back through the sync job).
  await registerUpstream(s!.id);
  ok(res, await queryOne(`SELECT ${SENDER_COLS} FROM sender_ids WHERE id = $1`, [s!.id]), 201);
});

const senderPatch = async (req: any, res: any) => {
  const b = senderSchema.partial().parse(req.body);
  const cur = await queryOne<any>(`SELECT ${SENDER_COLS} FROM sender_ids WHERE id = $1 AND account_id = $2`, [req.params.id, acc(req)]);
  if (!cur) throw notFound('Sender ID');
  // renaming resets approval
  const renamed = b.name && b.name !== cur.name;
  const s = await queryOne(
    `UPDATE sender_ids SET name = $3, purpose = $4, status = $5, sample_message = $6,
       textify_sender_id = CASE WHEN $7::boolean THEN NULL ELSE textify_sender_id END,
       textify_status = CASE WHEN $7::boolean THEN NULL ELSE textify_status END
     WHERE id = $1 AND account_id = $2 RETURNING ${SENDER_COLS}`,
    [cur.id, acc(req), (b.name ?? cur.name).toUpperCase(), b.purpose !== undefined ? b.purpose : cur.purpose, renamed ? 'pending' : cur.status,
      b.sample_message !== undefined ? b.sample_message : cur.sample_message, !!renamed],
  );
  if (renamed) await registerUpstream(cur.id);
  ok(res, renamed ? await queryOne(`SELECT ${SENDER_COLS} FROM sender_ids WHERE id = $1`, [cur.id]) : s);
};
accountRouter.patch('/sender-ids/:id', dash, senderPatch);
accountRouter.put('/sender-ids/:id', dash, senderPatch);

accountRouter.delete('/sender-ids/:id', dash, async (req, res) => {
  const r = await queryOne('DELETE FROM sender_ids WHERE id = $1 AND account_id = $2 RETURNING id', [req.params.id, acc(req)]);
  if (!r) throw notFound('Sender ID');
  res.status(204).end();
});

/* ---------------------------------------------------------------- API keys */

const KEY_COLS = 'id, name, prefix, mode, last_used_at, revoked_at, created_at';

accountRouter.get('/api-keys', jwtOnly, async (req, res) => {
  const { page, per_page, offset, limit } = pagination(req.query);
  const total = await queryOne<{ n: number }>('SELECT count(*)::int AS n FROM api_keys WHERE account_id = $1', [acc(req)]);
  const rows = await query(
    `SELECT ${KEY_COLS} FROM api_keys WHERE account_id = $1 ORDER BY revoked_at NULLS FIRST, created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    [acc(req)],
  );
  ok(res, rows, 200, { page, per_page, total: total?.n ?? 0 });
});

accountRouter.get('/api-keys/:id', jwtOnly, async (req, res) => {
  const k = await queryOne(`SELECT ${KEY_COLS} FROM api_keys WHERE id = $1 AND account_id = $2`, [req.params.id, acc(req)]);
  if (!k) throw notFound('API key');
  ok(res, k);
});

export function generateApiKey(mode: 'live' | 'test') {
  const key = `bc_${mode}_${randomToken(24)}`;
  return { key, prefix: key.slice(0, 12), hash: sha256(key) };
}

accountRouter.post('/api-keys', jwtOnly, async (req, res) => {
  const b = z.object({ name: z.string().trim().min(1).max(100).default('API key'), mode: z.enum(['live', 'test']).default('live') }).parse(req.body ?? {});
  const g = generateApiKey(b.mode);
  const k = await queryOne(
    `INSERT INTO api_keys (account_id, name, prefix, key_hash, mode) VALUES ($1, $2, $3, $4, $5) RETURNING ${KEY_COLS}`,
    [acc(req), b.name, g.prefix, g.hash, b.mode],
  );
  ok(res, { ...k, key: g.key }, 201);
});

accountRouter.patch('/api-keys/:id', jwtOnly, async (req, res) => {
  const b = z.object({ name: z.string().trim().min(1).max(100) }).parse(req.body);
  const k = await queryOne(`UPDATE api_keys SET name = $3 WHERE id = $1 AND account_id = $2 RETURNING ${KEY_COLS}`, [req.params.id, acc(req), b.name]);
  if (!k) throw notFound('API key');
  ok(res, k);
});

accountRouter.delete('/api-keys/:id', jwtOnly, async (req, res) => {
  const k = await queryOne(
    `UPDATE api_keys SET revoked_at = COALESCE(revoked_at, now()) WHERE id = $1 AND account_id = $2 RETURNING id`,
    [req.params.id, acc(req)],
  );
  if (!k) throw notFound('API key');
  res.status(204).end();
});

/* ---------------------------------------------------------------- webhooks */

const HOOK_COLS = 'id, url, events, active, created_at';
const hookBase = z.object({
  url: z.string().url().refine((u) => /^https?:\/\//i.test(u), 'URL must be http(s)'),
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1),
  active: z.boolean(),
});
const hookSchema = hookBase.extend({
  events: z.array(z.enum(WEBHOOK_EVENTS)).min(1).default([...WEBHOOK_EVENTS]),
  active: z.boolean().default(true),
});

accountRouter.get('/webhooks', dash, async (req, res) => {
  const { page, per_page, offset, limit } = pagination(req.query);
  const total = await queryOne<{ n: number }>('SELECT count(*)::int AS n FROM webhooks WHERE account_id = $1', [acc(req)]);
  const rows = await query(`SELECT ${HOOK_COLS} FROM webhooks WHERE account_id = $1 ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`, [acc(req)]);
  ok(res, rows, 200, { page, per_page, total: total?.n ?? 0, available_events: WEBHOOK_EVENTS });
});

accountRouter.get('/webhooks/:id', dash, async (req, res) => {
  const h = await queryOne(`SELECT ${HOOK_COLS} FROM webhooks WHERE id = $1 AND account_id = $2`, [req.params.id, acc(req)]);
  if (!h) throw notFound('Webhook');
  ok(res, h);
});

accountRouter.post('/webhooks', dash, async (req, res) => {
  const b = hookSchema.parse(req.body);
  const secret = `whsec_${randomToken(24)}`;
  const h = await queryOne(
    `INSERT INTO webhooks (account_id, url, events, secret, active) VALUES ($1, $2, $3, $4, $5) RETURNING ${HOOK_COLS}`,
    [acc(req), b.url, b.events, secret, b.active],
  );
  ok(res, { ...h, secret }, 201);
});

const hookPatch = async (req: any, res: any) => {
  const b = hookBase.partial().extend({ rotate_secret: z.boolean().optional() }).parse(req.body);
  const cur = await queryOne<any>('SELECT * FROM webhooks WHERE id = $1 AND account_id = $2', [req.params.id, acc(req)]);
  if (!cur) throw notFound('Webhook');
  const secret = b.rotate_secret ? `whsec_${randomToken(24)}` : cur.secret;
  const h = await queryOne(
    `UPDATE webhooks SET url = $3, events = $4, active = $5, secret = $6 WHERE id = $1 AND account_id = $2 RETURNING ${HOOK_COLS}`,
    [cur.id, acc(req), b.url ?? cur.url, b.events ?? cur.events, b.active ?? cur.active, secret],
  );
  ok(res, b.rotate_secret ? { ...h, secret } : h);
};
accountRouter.patch('/webhooks/:id', dash, hookPatch);
accountRouter.put('/webhooks/:id', dash, hookPatch);

accountRouter.delete('/webhooks/:id', dash, async (req, res) => {
  const r = await queryOne('DELETE FROM webhooks WHERE id = $1 AND account_id = $2 RETURNING id', [req.params.id, acc(req)]);
  if (!r) throw notFound('Webhook');
  res.status(204).end();
});

/** Sends a signed sample event synchronously and returns the receiver's response. */
accountRouter.post('/webhooks/:id/test', dash, async (req, res) => {
  const h = await queryOne<any>('SELECT * FROM webhooks WHERE id = $1 AND account_id = $2', [req.params.id, acc(req)]);
  if (!h) throw notFound('Webhook');
  const event = (req.body?.event as string) && WEBHOOK_EVENTS.includes(req.body.event) ? req.body.event : 'message.delivered';
  const body = buildPayload(event, {
    test: true,
    id: crypto.randomUUID(),
    to: '+255712345678',
    sender_id: config.defaultSenderId,
    body: 'Hii ni ujumbe wa majaribio — this is a test webhook from Bermi Connect',
    status: event === 'message.failed' ? 'failed' : 'delivered',
    segments: 1,
    cost_tzs: config.smsPriceTzs,
  });
  const result = await deliver(h.url, h.secret, event, body, crypto.randomUUID());
  ok(res, { ...result, event, payload: JSON.parse(body) });
});

/* ---------------------------------------------------------------- wallet & transactions */

const TX_COLS = 'id, type, status, amount_tzs, balance_after, description, reference, method, created_at';

accountRouter.get('/transactions', dash, async (req, res) => {
  const f = z.object({ type: z.enum(['topup', 'charge', 'refund', 'bonus']).optional() }).parse(req.query);
  const { page, per_page, offset, limit } = pagination(req.query);
  const w = new Where().add('account_id = ?', acc(req));
  if (f.type) w.add('type = ?', f.type);
  const total = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM transactions ${w.sql}`, w.params);
  const rows = await query(`SELECT ${TX_COLS} FROM transactions ${w.sql} ORDER BY created_at DESC, id LIMIT ${limit} OFFSET ${offset}`, w.params);
  ok(res, rows, 200, { page, per_page, total: total?.n ?? 0 });
});

const topupSchema = z.object({
  amount_tzs: z.coerce.number().min(1000, 'Minimum top-up is TZS 1,000').max(50_000_000),
  method: z.enum(['mpesa', 'tigopesa', 'airtel', 'mixx', 'halopesa', 'tpesa', 'card', 'manual']),
  phone: z.string().optional().nullable(),
});

accountRouter.post('/wallet/topup', dash, async (req, res) => {
  const b = topupSchema.parse(req.body);
  const a = acc(req);
  const mobile = ['mpesa', 'tigopesa', 'airtel', 'mixx', 'halopesa', 'tpesa'].includes(b.method);
  const phone = b.phone ? normalizePhone(b.phone) : null;
  if (mobile && !phone) throw badRequest('A valid mobile money phone number is required');
  const reference = `TOP-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const amount = Math.round(b.amount_tzs * 100) / 100;

  // Sandbox: credit immediately outside production.
  if (!config.isProd) {
    const transaction = await tx(async (c) => {
      await credit(c, a, amount, 'topup', `Top-up via ${b.method}${phone ? ` (${phone})` : ''} [sandbox]`, reference, b.method);
      return (await c.query(`SELECT ${TX_COLS} FROM transactions WHERE account_id = $1 AND reference = $2`, [a, reference])).rows[0];
    });
    const bal = await queryOne<{ balance_tzs: number }>('SELECT balance_tzs FROM accounts WHERE id = $1', [a]);
    return ok(res, { status: 'completed', transaction, balance_tzs: bal?.balance_tzs, sandbox: true }, 201);
  }

  if (b.method === 'manual') throw forbidden('Manual top-ups are done by Bermi staff in production');
  const transaction = await queryOne(
    `INSERT INTO transactions (account_id, type, status, amount_tzs, description, reference, method)
     VALUES ($1, 'topup', 'pending', $2, $3, $4, $5) RETURNING ${TX_COLS}`,
    [a, amount, `Top-up via ${b.method}${phone ? ` (${phone})` : ''}`, reference, b.method],
  );
  const method = b.method === 'tigopesa' ? 'mixx' : b.method;
  const init = await getPaymentProvider().initiate({ accountId: a, reference, amount, method, phone });
  ok(res, { status: 'pending', transaction, checkout_url: init.checkout_url, instructions: init.instructions }, 201);
});

/* ---------------------------------------------------------------- Buy SMS */

accountRouter.get('/wallet/packages', dash, async (_req, res) => {
  ok(res, {
    price_per_sms_tzs: config.smsPriceTzs,
    min_sms: MIN_SMS,
    tiers: priceTiers(),
    packages: config.smsPackages.map((n) => quote(n)),
    methods: PAYMENT_METHODS,
    provider: getPaymentProvider().name,
  });
});

accountRouter.post('/wallet/quote', dash, async (req, res) => {
  const { sms } = z.object({ sms: z.coerce.number().int().min(1).max(2_000_000) }).parse(req.body);
  ok(res, quote(sms));
});

const buySchema = z.object({
  sms: z.coerce.number().int(),
  method: z.enum(['mpesa', 'airtel', 'mixx', 'halopesa', 'tpesa', 'card']),
  phone: z.string().optional().nullable(),
});

accountRouter.post('/wallet/buy', dash, async (req, res) => {
  const b = buySchema.parse(req.body);
  const phone = b.phone ? normalizePhone(b.phone) : null;
  if (b.phone && !phone) throw badRequest('Enter a valid Tanzanian mobile number, like 0754 123 456');
  ok(res, await createPayment(acc(req), b.sms, b.method, phone), 201);
});

accountRouter.get('/wallet/payments', dash, async (req, res) => {
  ok(res, await listPayments(acc(req)));
});

accountRouter.get('/wallet/payments/:id', dash, async (req, res) => {
  ok(res, await getPayment(acc(req), req.params.id as string));
});

/** Payment gateway callback. Public; each provider verifies its own signature. */
accountRouter.post('/payments/webhook/:provider', async (req, res) => {
  const provider = getPaymentProvider(req.params.provider as any);
  if (provider.name !== req.params.provider) throw notFound('Payment provider');
  if (config.payments.webhookSecret) {
    const sig = String(req.header('x-payment-signature') ?? '');
    if (!safeEqual(sig, `sha256=${hmacSha256(config.payments.webhookSecret, JSON.stringify(req.body ?? {}))}`)) throw forbidden('Bad signature');
  }
  const r = await provider.parseWebhook(req.headers as any, req.body);
  if (!r.reference) throw badRequest('reference is required');
  const p = await confirmPayment(r.reference, r.status, r.reason);
  ok(res, { reference: r.reference, status: r.status, payment_id: p.id });
});

/* ---------------------------------------------------------------- admin */

accountRouter.get('/admin/sender-ids', jwtOnly, requireAdmin, async (req, res) => {
  const { status } = z.object({ status: z.enum(['pending', 'approved', 'rejected']).optional() }).parse(req.query);
  const { page, per_page, offset, limit } = pagination(req.query);
  const w = new Where();
  if (status) w.add('s.status = ?', status);
  const total = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM sender_ids s ${w.sql}`, w.params);
  const rows = await query(
    `SELECT s.id, s.name, s.purpose, s.sample_message, s.status, s.textify_status, s.sync_error, s.synced_at, s.created_at, s.account_id, a.name AS account_name
     FROM sender_ids s JOIN accounts a ON a.id = s.account_id ${w.sql}
     ORDER BY s.created_at LIMIT ${limit} OFFSET ${offset}`,
    w.params,
  );
  ok(res, rows, 200, { page, per_page, total: total?.n ?? 0 });
});

for (const action of ['approve', 'reject'] as const) {
  accountRouter.post(`/admin/sender-ids/:id/${action}`, jwtOnly, requireAdmin, async (req, res) => {
    const s = await queryOne(`UPDATE sender_ids SET status = $2, sync_error = NULL WHERE id = $1 RETURNING ${SENDER_COLS}, account_id`, [
      req.params.id,
      action === 'approve' ? 'approved' : 'rejected',
    ]);
    if (!s) throw notFound('Sender ID');
    ok(res, s);
  });
}

accountRouter.post('/admin/accounts/:id/credit', jwtOnly, requireAdmin, async (req, res) => {
  const b = z
    .object({ amount_tzs: z.coerce.number().positive().max(100_000_000), description: z.string().max(200).optional(), type: z.enum(['topup', 'bonus']).default('topup') })
    .parse(req.body);
  const exists = await queryOne('SELECT id FROM accounts WHERE id = $1', [req.params.id]);
  if (!exists) throw notFound('Account');
  const balance = await tx((c) =>
    credit(c, req.params.id as string, b.amount_tzs, b.type, b.description ?? `Credit by admin ${req.auth!.email}`, `admin:${req.auth!.userId}`, 'manual'),
  );
  ok(res, { account_id: req.params.id, balance_tzs: balance });
});

/** Upstream (Textify) status for the admin page. */
accountRouter.get('/admin/textify', jwtOnly, requireAdmin, async (_req, res) => {
  const api = textifyApi();
  const linkStatus = await redis.get(SMPP_STATUS_KEY).catch(() => null);
  const balance = api ? await api.getBalance().catch(() => null) : null;
  const counts = await query<{ status: string; n: number }>('SELECT status, count(*)::int AS n FROM sender_ids GROUP BY status');
  const errors = await query(`SELECT s.id, s.name, s.sync_error, a.name AS account_name FROM sender_ids s JOIN accounts a ON a.id = s.account_id
    WHERE s.sync_error IS NOT NULL ORDER BY s.created_at DESC LIMIT 20`);
  ok(res, {
    provider: config.smsProvider,
    upstream_status: linkStatus === 'bound' ? 'connected' : linkStatus ? 'down' : 'unknown',
    api_configured: !!api,
    default_sender_id: config.defaultSenderId,
    balance: balance ? { available: true, credits: balance.credits } : { available: false, note: 'Textify has not published its credits API yet (TODO adapter).' },
    sender_sync: await lastSenderSync(),
    sender_counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
    sender_errors: errors,
  });
});

accountRouter.post('/admin/textify/sync-senders', jwtOnly, requireAdmin, async (_req, res) => {
  ok(res, await syncSenderNames());
});

/** Not in spec: account list for the admin UI. */
accountRouter.get('/admin/accounts', jwtOnly, requireAdmin, async (req, res) => {
  const { page, per_page, offset, limit } = pagination(req.query);
  const total = await queryOne<{ n: number }>('SELECT count(*)::int AS n FROM accounts');
  const rows = await query(
    `SELECT a.id, a.name, a.type, a.phone, a.balance_tzs, a.created_at,
            (SELECT email FROM users u WHERE u.account_id = a.id AND u.role = 'owner' ORDER BY created_at LIMIT 1) AS owner_email
     FROM accounts a ORDER BY a.created_at DESC LIMIT ${limit} OFFSET ${offset}`,
  );
  ok(res, rows, 200, { page, per_page, total: total?.n ?? 0 });
});

export { ApiError };
