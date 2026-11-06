import crypto from 'node:crypto';
import { query } from '../db.js';
import { hmacSha256 } from '../lib/crypto.js';
import { logger } from '../logger.js';
import { webhookQueue } from '../queues.js';

export const WEBHOOK_EVENTS = ['message.delivered', 'message.failed', 'campaign.completed', 'message.inbound'] as const;
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number];

export function buildPayload(event: string, data: unknown): string {
  return JSON.stringify({ event, data, created_at: new Date().toISOString() });
}

export function signature(secret: string, body: string): string {
  return `sha256=${hmacSha256(secret, body)}`;
}

/** Enqueue a webhook delivery for every active subscription of the account to this event. */
export async function dispatchEvent(accountId: string | null, event: WebhookEvent, data: unknown): Promise<number> {
  if (!accountId) return 0;
  const hooks = await query<{ id: string }>(
    'SELECT id FROM webhooks WHERE account_id = $1 AND active = true AND $2 = ANY(events)',
    [accountId, event],
  );
  if (!hooks.length) return 0;
  const body = buildPayload(event, data);
  await webhookQueue().addBulk(
    hooks.map((h) => {
      const deliveryId = crypto.randomUUID();
      return { name: event, data: { webhookId: h.id, event, body, deliveryId }, opts: { jobId: `wh-${deliveryId}` } };
    }),
  );
  return hooks.length;
}

export interface DeliveryResult {
  ok: boolean;
  status: number | null;
  duration_ms: number;
  response_body?: string;
  error?: string;
}

/** Perform one HTTP delivery (used by the worker and by POST /webhooks/:id/test). */
export async function deliver(url: string, secret: string, event: string, body: string, deliveryId: string): Promise<DeliveryResult> {
  const started = Date.now();
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BermiConnect-Webhooks/1.0',
        'X-Bermi-Signature': signature(secret, body),
        'X-Bermi-Event': event,
        'X-Bermi-Delivery': deliveryId,
      },
      body,
      signal: AbortSignal.timeout(10_000),
      redirect: 'manual',
    });
    const text = (await res.text().catch(() => '')).slice(0, 1000);
    return { ok: res.ok, status: res.status, duration_ms: Date.now() - started, response_body: text };
  } catch (e: any) {
    logger.debug({ err: e?.message, url }, 'webhook delivery error');
    return { ok: false, status: null, duration_ms: Date.now() - started, error: e?.message ?? String(e) };
  }
}
