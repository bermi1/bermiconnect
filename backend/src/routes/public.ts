import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { pool } from '../db.js';
import { unauthorized } from '../errors.js';
import { safeEqual } from '../lib/crypto.js';
import { ok } from '../lib/http.js';
import { redis, SMPP_STATUS_KEY } from '../redis.js';
import { applyReceipt, handleInbound, parseReceipt } from '../services/messages.js';

export const publicRouter = Router();

publicRouter.get('/health', async (_req, res) => {
  const [db, r, smpp] = await Promise.all([
    pool.query('SELECT 1').then(() => true, () => false),
    redis.ping().then(() => true, () => false),
    redis.get(SMPP_STATUS_KEY).catch(() => null),
  ]);
  const smppStatus = smpp === 'bound' ? 'bound' : 'down';
  const healthy = db && r;
  // upstream = the route to Textify as last reported by the worker (SMPP bind, or HTTP API reachability)
  const upstream = { provider: config.smsProvider, status: smpp === 'bound' ? 'connected' : smpp ? 'down' : 'unknown' };
  res.status(healthy ? 200 : 503).json({ data: { ok: healthy, db, redis: r, smpp: smppStatus, provider: config.smsProvider, upstream } });
});

/**
 * HTTP fallback for Textify MO / DLR pushes. Accepts JSON or form bodies:
 *  DLR:     { type: 'dlr', message_id, status: 'DELIVRD'|'UNDELIV'|..., err? }   or { text: 'id:.. stat:..' }
 *  Inbound: { type: 'mo', from, to, text }
 * If INBOUND_WEBHOOK_TOKEN is set it must be supplied as ?token= or X-Inbound-Token.
 */
publicRouter.post('/inbound/textify', async (req, res) => {
  if (config.inboundToken) {
    const given = String(req.query.token ?? req.header('x-inbound-token') ?? '');
    if (!safeEqual(given, config.inboundToken)) throw unauthorized('Invalid inbound token');
  }
  const b = z
    .object({
      type: z.string().optional(),
      message_id: z.string().optional(),
      id: z.string().optional(),
      status: z.string().optional(),
      stat: z.string().optional(),
      err: z.string().optional(),
      from: z.string().optional(),
      msisdn: z.string().optional(),
      to: z.string().optional(),
      text: z.string().optional(),
      message: z.string().optional(),
      body: z.string().optional(),
    })
    .passthrough()
    .parse(req.body ?? {});
  const text = b.text ?? b.message ?? b.body ?? '';
  const receiptFromText = text ? parseReceipt(text) : null;
  const dlrId = b.message_id ?? b.id ?? receiptFromText?.id;
  const stat = (b.status ?? b.stat ?? receiptFromText?.stat)?.toUpperCase();
  const isDlr = b.type?.toLowerCase() === 'dlr' || (!!dlrId && !!stat && b.type?.toLowerCase() !== 'mo');
  if (isDlr) {
    if (!dlrId || !stat) return ok(res, { accepted: false, reason: 'missing message_id/status' }, 400);
    const matched = await applyReceipt(dlrId, stat, b.err ?? receiptFromText?.err ?? null);
    return ok(res, { accepted: true, type: 'dlr', matched: matched !== false });
  }
  const from = b.from ?? b.msisdn;
  if (!from || !text) return ok(res, { accepted: false, reason: 'missing from/text' }, 400);
  const r = await handleInbound(from, b.to ?? null, text);
  ok(res, { accepted: true, type: 'mo', id: r.inbound?.id, opted_out: r.optedOut });
});
