import bcrypt from 'bcryptjs';
import { Router } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { query, queryOne, tx } from '../db.js';
import { badRequest, conflict, notFound, unauthorized } from '../errors.js';
import { ok } from '../lib/http.js';
import { normalizePhone } from '../lib/phone.js';
import { acc, auth, signToken } from '../middleware/auth.js';
import { credit } from '../services/billing.js';

export const authRouter = Router();

const USER_COLS = 'id, account_id, name, email, role, created_at';
const ACCOUNT_COLS = 'id, name, type, phone, balance_tzs, created_at';

function publicUser(u: any) {
  return { ...u, is_admin: config.adminEmails.includes(String(u.email).toLowerCase()) };
}

const registerSchema = z.object({
  name: z.string().trim().min(1).max(120),
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(8, 'Password must be at least 8 characters').max(200),
  account_name: z.string().trim().min(1).max(160),
  account_type: z.enum(['school', 'business', 'developer', 'other']).default('other'),
  phone: z.string().trim().optional().nullable(),
});

authRouter.post('/auth/register', async (req, res) => {
  const b = registerSchema.parse(req.body);
  const phone = b.phone ? normalizePhone(b.phone) : null;
  if (b.phone && !phone) throw badRequest('Invalid phone number');
  const exists = await queryOne('SELECT 1 FROM users WHERE email = $1', [b.email]);
  if (exists) throw conflict('An account with this email already exists');
  const hash = await bcrypt.hash(b.password, 10);
  const out = await tx(async (c) => {
    const a = await c.query(`INSERT INTO accounts (name, type, phone) VALUES ($1, $2, $3) RETURNING id`, [
      b.account_name,
      b.account_type,
      phone,
    ]);
    const accountId = a.rows[0].id;
    const u = await c.query(
      `INSERT INTO users (account_id, name, email, password_hash, role) VALUES ($1, $2, $3, $4, 'owner') RETURNING ${USER_COLS}`,
      [accountId, b.name, b.email, hash],
    );
    if (config.signupFreeCreditTzs > 0) {
      await credit(c, accountId, config.signupFreeCreditTzs, 'bonus', 'Welcome bonus — Karibu Bermi Connect!', 'signup');
    }
    const account = (await c.query(`SELECT ${ACCOUNT_COLS} FROM accounts WHERE id = $1`, [accountId])).rows[0];
    return { user: u.rows[0], account };
  }).catch((e) => {
    if (e?.code === '23505') throw conflict('An account with this email already exists');
    throw e;
  });
  ok(res, { token: signToken(out.user.id, out.account.id), user: publicUser(out.user), account: out.account }, 201);
});

const loginSchema = z.object({ email: z.string().trim().toLowerCase().email(), password: z.string().min(1) });

authRouter.post('/auth/login', async (req, res) => {
  const b = loginSchema.parse(req.body);
  const u = await queryOne<any>(`SELECT ${USER_COLS}, password_hash FROM users WHERE email = $1`, [b.email]);
  if (!u || !(await bcrypt.compare(b.password, u.password_hash))) throw unauthorized('Invalid email or password');
  delete u.password_hash;
  const account = await queryOne(`SELECT ${ACCOUNT_COLS} FROM accounts WHERE id = $1`, [u.account_id]);
  ok(res, { token: signToken(u.id, u.account_id), user: publicUser(u), account });
});

authRouter.get('/me', auth('jwt'), async (req, res) => {
  const user = await queryOne(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [req.auth!.userId]);
  const account = await queryOne(`SELECT ${ACCOUNT_COLS} FROM accounts WHERE id = $1`, [acc(req)]);
  if (!user || !account) throw notFound('User');
  ok(res, { user: publicUser(user), account });
});

const patchMeSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  account_name: z.string().trim().min(1).max(160).optional(),
  account_phone: z.string().trim().optional().nullable(),
  current_password: z.string().optional(),
  new_password: z.string().min(8).max(200).optional(),
});

authRouter.patch('/me', auth('jwt'), async (req, res) => {
  const b = patchMeSchema.parse(req.body);
  if (b.name) await query('UPDATE users SET name = $2 WHERE id = $1', [req.auth!.userId, b.name]);
  if (b.account_name) await query('UPDATE accounts SET name = $2 WHERE id = $1', [acc(req), b.account_name]);
  if (b.account_phone !== undefined) {
    const p = b.account_phone ? normalizePhone(b.account_phone) : null;
    await query('UPDATE accounts SET phone = $2 WHERE id = $1', [acc(req), p]);
  }
  if (b.new_password) {
    const u = await queryOne<{ password_hash: string }>('SELECT password_hash FROM users WHERE id = $1', [req.auth!.userId]);
    if (!u || !b.current_password || !(await bcrypt.compare(b.current_password, u.password_hash)))
      throw unauthorized('Current password is incorrect');
    await query('UPDATE users SET password_hash = $2 WHERE id = $1', [req.auth!.userId, await bcrypt.hash(b.new_password, 10)]);
  }
  const user = await queryOne(`SELECT ${USER_COLS} FROM users WHERE id = $1`, [req.auth!.userId]);
  const account = await queryOne(`SELECT ${ACCOUNT_COLS} FROM accounts WHERE id = $1`, [acc(req)]);
  ok(res, { user: publicUser(user), account });
});

authRouter.get('/account/stats', auth('dashboard'), async (req, res) => {
  const a = acc(req);
  const [bal, today, d30, active, contacts, daily] = await Promise.all([
    queryOne<{ balance_tzs: number }>('SELECT balance_tzs FROM accounts WHERE id = $1', [a]),
    queryOne<{ n: number }>(
      `SELECT count(*)::int AS n FROM messages WHERE account_id = $1 AND test_mode = false
         AND created_at >= date_trunc('day', now()) AND status NOT IN ('rejected')`,
      [a],
    ),
    queryOne<{ sent: number; delivered: number; failed: number }>(
      `SELECT count(*) FILTER (WHERE status IN ('sent','delivered','failed'))::int AS sent,
              count(*) FILTER (WHERE status = 'delivered')::int AS delivered,
              count(*) FILTER (WHERE status IN ('failed','rejected'))::int AS failed
       FROM messages WHERE account_id = $1 AND test_mode = false AND created_at >= now() - interval '30 days'`,
      [a],
    ),
    queryOne<{ n: number }>(`SELECT count(*)::int AS n FROM campaigns WHERE account_id = $1 AND status IN ('scheduled','sending')`, [a]),
    queryOne<{ n: number }>('SELECT count(*)::int AS n FROM contacts WHERE account_id = $1', [a]),
    query<{ date: string; sent: number; delivered: number; failed: number }>(
      `SELECT to_char(d.day, 'YYYY-MM-DD') AS date,
              count(m.id) FILTER (WHERE m.status IN ('sent','delivered','failed'))::int AS sent,
              count(m.id) FILTER (WHERE m.status = 'delivered')::int AS delivered,
              count(m.id) FILTER (WHERE m.status IN ('failed','rejected'))::int AS failed
       FROM generate_series(date_trunc('day', now()) - interval '13 days', date_trunc('day', now()), interval '1 day') AS d(day)
       LEFT JOIN messages m ON m.account_id = $1 AND m.test_mode = false
            AND m.created_at >= d.day AND m.created_at < d.day + interval '1 day'
       GROUP BY d.day ORDER BY d.day`,
      [a],
    ),
  ]);
  const finished = (d30?.delivered ?? 0) + (d30?.failed ?? 0);
  ok(res, {
    balance_tzs: bal?.balance_tzs ?? 0,
    price_per_sms_tzs: config.smsPriceTzs,
    sent_today: today?.n ?? 0,
    sent_30d: d30?.sent ?? 0,
    delivered_rate: finished ? Math.round(((d30?.delivered ?? 0) / finished) * 10000) / 10000 : 0,
    campaigns_active: active?.n ?? 0,
    contacts_total: contacts?.n ?? 0,
    daily,
  });
});
