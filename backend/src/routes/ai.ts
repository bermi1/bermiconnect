import { Router } from 'express';
import { z } from 'zod';
import { aiWrite, AiNotConfiguredError, AiProviderError, getProvider } from '../ai/index.js';
import { config } from '../config.js';
import { ApiError } from '../errors.js';
import { ok } from '../lib/http.js';
import { acc, auth } from '../middleware/auth.js';
import { redis } from '../redis.js';

export const aiRouter = Router();

const ACTIONS = ['write', 'shorten', 'swahili', 'english', 'friendlier', 'formal'] as const;
const schema = z
  .object({
    action: z.enum(ACTIONS),
    text: z.string().max(2000).optional(),
    prompt: z.string().max(500).optional(),
  })
  .superRefine((b, ctx) => {
    if (b.action === 'write' && !b.prompt?.trim()) ctx.addIssue({ code: 'custom', path: ['prompt'], message: 'prompt is required for action "write"' });
    if (b.action !== 'write' && !b.text?.trim()) ctx.addIssue({ code: 'custom', path: ['text'], message: `text is required for action "${b.action}"` });
  });

const notConfigured = () => new ApiError(503, 'ai_not_configured', "AI help isn't switched on yet");

/** 100 AI calls per account per UTC day (AI_DAILY_LIMIT). Counted before calling the provider. */
async function dailyQuota(accountId: string, res: any) {
  const day = new Date().toISOString().slice(0, 10);
  const key = `bermi:ai:${accountId}:${day}`;
  let n: number;
  try {
    const r = await redis.multi().incr(key).expire(key, 60 * 60 * 26).exec();
    n = Number(r?.[0]?.[1] ?? 0);
  } catch {
    return; // fail open if Redis is down
  }
  const limit = config.ai.dailyLimit;
  res.setHeader('X-AI-Limit', String(limit));
  res.setHeader('X-AI-Remaining', String(Math.max(0, limit - n)));
  if (n > limit) {
    const midnight = new Date(`${day}T00:00:00Z`).getTime() + 86_400_000;
    res.setHeader('Retry-After', String(Math.ceil((midnight - Date.now()) / 1000)));
    throw new ApiError(429, 'rate_limited', `You have used today's ${limit} AI suggestions. They reset at midnight (UTC).`);
  }
}

// JWT or live API key ('dashboard' level).
aiRouter.post('/ai/write', auth('dashboard'), async (req, res) => {
  const b = schema.parse(req.body);
  if (!getProvider()) throw notConfigured();
  await dailyQuota(acc(req), res);
  try {
    const r = await aiWrite({ action: b.action, text: b.text?.trim() ?? '', prompt: b.prompt?.trim() ?? '' });
    ok(res, { text: r.text, length: r.length, segments: r.segments, encoding: r.encoding, warnings: r.warnings });
  } catch (e) {
    if (e instanceof AiNotConfiguredError) throw notConfigured();
    if (e instanceof AiProviderError) throw new ApiError(502, 'ai_unavailable', 'AI help could not answer just now. Try again in a minute.');
    throw e;
  }
});
