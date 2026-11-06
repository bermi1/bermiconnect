import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { config } from '../config.js';
import { queryOne, query } from '../db.js';
import { forbidden, unauthorized, ApiError } from '../errors.js';
import { sha256 } from '../lib/crypto.js';
import { redis } from '../redis.js';
import type { AuthContext } from '../types/express.js';

export interface JwtPayload {
  sub: string; // user id
  acc: string; // account id
}

export function signToken(userId: string, accountId: string): string {
  return jwt.sign({ sub: userId, acc: accountId } satisfies JwtPayload, config.jwtSecret, { expiresIn: '7d' });
}

function extractCredential(req: Request): string | null {
  const h = req.header('authorization');
  if (h) {
    const m = /^Bearer\s+(.+)$/i.exec(h.trim());
    if (m) return m[1].trim();
  }
  const k = req.header('x-api-key');
  return k ? k.trim() : null;
}

export const isApiKey = (s: string) => s.startsWith('bc_live_') || s.startsWith('bc_test_');

async function resolve(req: Request): Promise<AuthContext> {
  const cred = extractCredential(req);
  if (!cred) throw unauthorized('Missing Authorization header (Bearer <token> or X-API-Key)');

  if (isApiKey(cred)) {
    const key = await queryOne<{ id: string; account_id: string; mode: 'live' | 'test'; revoked_at: Date | null }>(
      'SELECT id, account_id, mode, revoked_at FROM api_keys WHERE key_hash = $1',
      [sha256(cred)],
    );
    if (!key || key.revoked_at) throw unauthorized('Invalid or revoked API key');
    // best-effort, don't block request
    query('UPDATE api_keys SET last_used_at = now() WHERE id = $1', [key.id]).catch(() => {});
    return { accountId: key.account_id, method: 'api_key', apiKeyId: key.id, mode: key.mode, isPlatformAdmin: false };
  }

  let payload: JwtPayload;
  try {
    payload = jwt.verify(cred, config.jwtSecret) as unknown as JwtPayload;
  } catch {
    throw unauthorized('Invalid or expired token');
  }
  const user = await queryOne<{ id: string; account_id: string; email: string; role: AuthContext['role'] }>(
    'SELECT id, account_id, email, role FROM users WHERE id = $1',
    [payload.sub],
  );
  if (!user) throw unauthorized('User no longer exists');
  return {
    accountId: user.account_id,
    method: 'jwt',
    userId: user.id,
    email: user.email,
    role: user.role,
    mode: 'live',
    isPlatformAdmin: config.adminEmails.includes(user.email.toLowerCase()),
  };
}

/**
 * Access levels:
 *  - 'jwt'       dashboard user only
 *  - 'dashboard' JWT or a *live* API key
 *  - 'developer' JWT or any API key (live or test)
 */
export function auth(level: 'jwt' | 'dashboard' | 'developer' = 'dashboard') {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      const ctx = await resolve(req);
      if (level === 'jwt' && ctx.method !== 'jwt') throw forbidden('This endpoint requires a dashboard login (JWT), not an API key');
      if (level === 'dashboard' && ctx.mode === 'test')
        throw forbidden('Test-mode API keys can only access the messaging API (/sms, /otp, /balance)');
      req.auth = ctx;
      if (ctx.method === 'api_key') await rateLimit(ctx.apiKeyId!, res);
      next();
    } catch (e) {
      next(e);
    }
  };
}

export function requireAdmin(req: Request, _res: Response, next: NextFunction) {
  if (!req.auth || req.auth.method !== 'jwt' || !req.auth.isPlatformAdmin) return next(forbidden('Platform admin only'));
  next();
}

/** Fixed-window per API key rate limit in Redis. */
async function rateLimit(apiKeyId: string, res: Response) {
  const limit = config.apiKeyRateLimitPerMin;
  const windowSec = 60;
  const nowSec = Math.floor(Date.now() / 1000);
  const window = Math.floor(nowSec / windowSec);
  const key = `bermi:rl:${apiKeyId}:${window}`;
  let count: number;
  try {
    const r = await redis.multi().incr(key).expire(key, windowSec + 5).exec();
    count = Number(r?.[0]?.[1] ?? 0);
  } catch {
    return; // fail open if Redis is unavailable
  }
  const reset = (window + 1) * windowSec;
  res.setHeader('X-RateLimit-Limit', String(limit));
  res.setHeader('X-RateLimit-Remaining', String(Math.max(0, limit - count)));
  res.setHeader('X-RateLimit-Reset', String(reset));
  if (count > limit) {
    res.setHeader('Retry-After', String(Math.max(1, reset - nowSec)));
    throw new ApiError(429, 'rate_limited', `Rate limit of ${limit} requests per minute exceeded`);
  }
}

export const acc = (req: Request) => req.auth!.accountId;
