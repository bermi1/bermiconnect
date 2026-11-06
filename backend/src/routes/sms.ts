import bcrypt from 'bcryptjs';
import crypto from 'node:crypto';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { query, queryOne } from '../db.js';
import { badRequest, notFound } from '../errors.js';
import { randomDigits } from '../lib/crypto.js';
import { ok, pagination, Where } from '../lib/http.js';
import { normalizePhone } from '../lib/phone.js';
import { renderTemplate } from '../lib/render.js';
import { countSegments } from '../lib/segments.js';
import { acc, auth } from '../middleware/auth.js';
import { round2 } from '../services/billing.js';
import { createMessages, MESSAGE_PUBLIC_COLUMNS } from '../services/messages.js';
import { resolveSenderId } from '../services/senderIds.js';

export const smsRouter = Router();
const dev = auth('developer');

const sendSchema = z.object({
  to: z.union([z.string().min(1), z.array(z.string().min(1)).min(1).max(1000)]),
  message: z.string().min(1, 'message is required').max(1530 * 2),
  sender_id: z.string().trim().max(11).optional().nullable(),
  reference: z.string().max(100).optional().nullable(),
  schedule_at: z.coerce.date().optional().nullable(),
});

smsRouter.post('/sms/send', dev, async (req, res) => {
  const b = sendSchema.parse(req.body);
  const raw = Array.isArray(b.to) ? b.to : b.to.split(',').map((s) => s.trim()).filter(Boolean);
  if (raw.length > 1000) throw badRequest('Maximum 1000 recipients per request');
  const invalid: string[] = [];
  const seen = new Set<string>();
  const phones: string[] = [];
  for (const r of raw) {
    const p = normalizePhone(r);
    if (!p) invalid.push(r);
    else if (!seen.has(p)) {
      seen.add(p);
      phones.push(p);
    }
  }
  if (invalid.length) throw badRequest(`Invalid phone number(s): ${invalid.slice(0, 20).join(', ')}`, { invalid });
  if (b.schedule_at && b.schedule_at.getTime() < Date.now() - 60_000) throw badRequest('schedule_at must be in the future');

  const a = acc(req);
  const senderId = await resolveSenderId(a, b.sender_id);
  // skip opted-out contacts
  const opted = await query<{ phone: string }>(
    'SELECT phone FROM contacts WHERE account_id = $1 AND phone = ANY($2) AND opted_out = true',
    [a, phones],
  );
  const optedSet = new Set(opted.map((o) => o.phone));
  const targets = phones.filter((p) => !optedSet.has(p));
  if (!targets.length) throw badRequest('All recipients have opted out', { opted_out: [...optedSet] });

  const batchId = crypto.randomUUID();
  const testMode = req.auth!.mode === 'test';
  const created = await createMessages(
    targets.map((to) => ({ to, body: b.message })),
    {
      accountId: a,
      senderId,
      apiKeyId: req.auth!.apiKeyId ?? null,
      batchId,
      reference: b.reference ?? null,
      testMode,
      scheduleAt: b.schedule_at ?? null,
      description: `SMS to ${targets.length} recipient${targets.length > 1 ? 's' : ''}`,
    },
  );
  ok(
    res,
    {
      batch_id: batchId,
      messages: created.map((m) => ({ id: m.id, to: m.to, status: m.status, segments: m.segments, cost_tzs: m.cost_tzs })),
      total_cost_tzs: round2(created.reduce((s, m) => s + Number(m.cost_tzs), 0)),
      test_mode: testMode,
      ...(optedSet.size ? { opted_out: [...optedSet] } : {}),
    },
    202,
  );
});

smsRouter.get('/sms/:id', dev, async (req, res) => {
  const m = await queryOne(`SELECT ${MESSAGE_PUBLIC_COLUMNS} FROM messages WHERE id = $1 AND account_id = $2`, [
    req.params.id,
    acc(req),
  ]);
  if (!m) throw notFound('Message');
  ok(res, m);
});

const listSchema = z.object({
  status: z.enum(['queued', 'sent', 'delivered', 'failed', 'rejected']).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  campaign_id: z.string().uuid().optional(),
  batch_id: z.string().uuid().optional(),
  phone: z.string().optional(),
  q: z.string().optional(),
});

smsRouter.get('/sms', dev, async (req, res) => {
  const f = listSchema.parse(req.query);
  const { page, per_page, offset, limit } = pagination(req.query);
  const w = new Where().add('account_id = ?', acc(req));
  if (f.status) w.add('status = ?', f.status);
  if (f.from) w.add('created_at >= ?', f.from);
  if (f.to) w.add('created_at <= ?', f.to);
  if (f.campaign_id) w.add('campaign_id = ?', f.campaign_id);
  if (f.batch_id) w.add('batch_id = ?', f.batch_id);
  if (f.phone) w.add('to_phone = ?', normalizePhone(f.phone) ?? f.phone);
  if (f.q) w.add('(to_phone ILIKE ? OR body ILIKE ?)', `%${f.q}%`, `%${f.q}%`);
  const total = await queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM messages ${w.sql}`, w.params);
  const rows = await query(
    `SELECT ${MESSAGE_PUBLIC_COLUMNS} FROM messages ${w.sql} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
    w.params,
  );
  ok(res, rows, 200, { page, per_page, total: total?.n ?? 0 });
});

/* ---------------------------------------------------------------- OTP */

const otpSendSchema = z.object({
  phone: z.string().min(1),
  sender_id: z.string().trim().max(11).optional().nullable(),
  length: z.coerce.number().int().min(4).max(10).default(6),
  expires_in: z.coerce.number().int().min(30).max(3600).default(300),
  template: z.string().min(1).max(480).default('Your code is {{code}}'),
});

smsRouter.post('/otp/send', dev, async (req, res) => {
  const b = otpSendSchema.parse(req.body);
  if (!b.template.includes('{{code}}')) throw badRequest('template must contain {{code}}');
  const phone = normalizePhone(b.phone);
  if (!phone) throw badRequest('Invalid phone number');
  const a = acc(req);
  const senderId = await resolveSenderId(a, b.sender_id);
  const code = randomDigits(b.length);
  const body = renderTemplate(b.template, null, { code });
  const testMode = req.auth!.mode === 'test';
  const [msg] = await createMessages([{ to: phone, body }], {
    accountId: a,
    senderId,
    apiKeyId: req.auth!.apiKeyId ?? null,
    testMode,
    description: `OTP to ${phone}`,
    reference: 'otp',
  });
  const expiresAt = new Date(Date.now() + b.expires_in * 1000);
  const otp = await queryOne<{ id: string }>(
    `INSERT INTO otp_requests (account_id, phone, code_hash, message_id, expires_at) VALUES ($1, $2, $3, $4, $5) RETURNING id`,
    [a, phone, await bcrypt.hash(code, 8), msg.id, expiresAt],
  );
  ok(res, {
    otp_id: otp!.id,
    expires_at: expiresAt.toISOString(),
    message_id: msg.id,
    cost_tzs: msg.cost_tzs,
    // Test keys get the code back so integrations can be tested end-to-end without a phone.
    ...(testMode ? { code } : {}),
  });
});

const otpVerifySchema = z.object({ otp_id: z.string().uuid(), code: z.string().trim().min(1).max(10) });
const MAX_OTP_ATTEMPTS = 5;

smsRouter.post('/otp/verify', dev, async (req, res) => {
  const b = otpVerifySchema.parse(req.body);
  const otp = await queryOne<any>('SELECT * FROM otp_requests WHERE id = $1 AND account_id = $2', [b.otp_id, acc(req)]);
  if (!otp) throw notFound('OTP');
  if (otp.verified_at) return ok(res, { verified: false, reason: 'already_used' });
  if (new Date(otp.expires_at).getTime() < Date.now()) return ok(res, { verified: false, reason: 'expired' });
  if (otp.attempts >= MAX_OTP_ATTEMPTS) return ok(res, { verified: false, reason: 'too_many_attempts' });
  const match = await bcrypt.compare(b.code, otp.code_hash);
  if (!match) {
    await query('UPDATE otp_requests SET attempts = attempts + 1 WHERE id = $1', [otp.id]);
    return ok(res, { verified: false, reason: 'invalid_code', attempts_remaining: MAX_OTP_ATTEMPTS - otp.attempts - 1 });
  }
  const upd = await queryOne(
    'UPDATE otp_requests SET verified_at = now(), attempts = attempts + 1 WHERE id = $1 AND verified_at IS NULL RETURNING id',
    [otp.id],
  );
  ok(res, upd ? { verified: true } : { verified: false, reason: 'already_used' });
});

/* ---------------------------------------------------------------- balance & segment helper */

smsRouter.get('/balance', dev, async (req, res) => {
  const a = await queryOne<{ balance_tzs: number }>('SELECT balance_tzs FROM accounts WHERE id = $1', [acc(req)]);
  ok(res, { balance_tzs: a?.balance_tzs ?? 0, price_per_sms_tzs: config.smsPriceTzs, currency: 'TZS' });
});

/** Not in spec: handy for the UI/SDKs; no auth needed. */
smsRouter.post('/sms/segments', async (req, res) => {
  const { message } = z.object({ message: z.string() }).parse(req.body);
  const s = countSegments(message);
  ok(res, { ...s, cost_tzs: round2(s.segments * config.smsPriceTzs) });
});
