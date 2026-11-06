import { query, queryOne, tx } from '../db.js';
import { insufficientBalance } from '../errors.js';
import { renderTemplate } from '../lib/render.js';
import { countSegments } from '../lib/segments.js';
import { logger } from '../logger.js';
import { campaignJobId, campaignQueue } from '../queues.js';
import { round2 } from './billing.js';
import { enqueueMessages, insertAndCharge, maybeCompleteCampaign, priceFor } from './messages.js';

export interface Recipient {
  id: string;
  phone: string;
  first_name: string | null;
  last_name: string | null;
  fields: Record<string, unknown>;
}

/** Distinct, non-opted-out contacts across the given groups (account-scoped). */
export async function recipientsFor(accountId: string, groupIds: string[]): Promise<Recipient[]> {
  if (!groupIds.length) return [];
  return query<Recipient>(
    `SELECT DISTINCT ON (c.phone) c.id, c.phone, c.first_name, c.last_name, c.fields
     FROM contacts c
     JOIN contact_group_members m ON m.contact_id = c.id
     JOIN contact_groups g ON g.id = m.group_id
     WHERE c.account_id = $1 AND g.account_id = $1 AND m.group_id = ANY($2::uuid[]) AND c.opted_out = false
     ORDER BY c.phone, c.created_at`,
    [accountId, groupIds],
  );
}

export async function estimate(accountId: string, groupIds: string[], body: string) {
  const recips = await recipientsFor(accountId, groupIds);
  let segments = 0;
  for (const r of recips) segments += countSegments(renderTemplate(body, r)).segments;
  const sample = countSegments(renderTemplate(body, recips[0] ?? null));
  return {
    recipients: recips.length,
    segments,
    segments_per_message: sample.segments,
    encoding: sample.encoding,
    cost_tzs: round2(priceFor(segments)),
  };
}

/** Schedule (delayed job) or dispatch immediately. */
export async function queueCampaign(campaignId: string, at: Date | null) {
  const q = campaignQueue();
  const jobId = campaignJobId(campaignId);
  const existing = await q.getJob(jobId);
  if (existing) await existing.remove().catch(() => {});
  const delay = at ? Math.max(0, at.getTime() - Date.now()) : 0;
  await q.add('dispatch', { campaignId }, { jobId, delay });
}

export async function unqueueCampaign(campaignId: string) {
  const job = await campaignQueue().getJob(campaignJobId(campaignId));
  if (job) await job.remove().catch(() => {});
}

/**
 * Expand recipients, render personalised bodies, charge total atomically, enqueue SMS.
 * Insufficient balance → campaign 'failed'.
 */
export async function dispatchCampaign(campaignId: string) {
  const c = await queryOne<any>('SELECT * FROM campaigns WHERE id = $1', [campaignId]);
  if (!c) return;
  if (!['scheduled', 'sending'].includes(c.status)) {
    logger.info({ campaignId, status: c.status }, 'campaign not dispatchable, skipping');
    return;
  }
  const already = await queryOne<{ n: number }>('SELECT count(*)::int AS n FROM messages WHERE campaign_id = $1', [campaignId]);
  if (already && already.n > 0) {
    // retry after a crash post-commit: just make sure jobs exist
    const ids = await query<{ id: string }>(`SELECT id FROM messages WHERE campaign_id = $1 AND status = 'queued'`, [campaignId]);
    await enqueueMessages(ids.map((r) => r.id));
    return;
  }
  const recips = await recipientsFor(c.account_id, c.group_ids);
  if (!recips.length) {
    await query(
      `UPDATE campaigns SET status = 'completed', started_at = COALESCE(started_at, now()), completed_at = now(), total_recipients = 0 WHERE id = $1`,
      [campaignId],
    );
    await maybeCompleteCampaign(campaignId);
    return;
  }
  const items = recips.map((r) => ({ to: r.phone, body: renderTemplate(c.body, r), contactId: r.id }));
  let created;
  try {
    created = await tx(async (client) => {
      const lock = await client.query(`SELECT status FROM campaigns WHERE id = $1 FOR UPDATE`, [campaignId]);
      if (!['scheduled', 'sending'].includes(lock.rows[0]?.status)) return null;
      const msgs = await insertAndCharge(client, items, {
        accountId: c.account_id,
        senderId: c.sender_id,
        campaignId,
        description: `Campaign "${c.name}" (${items.length} recipients)`,
      });
      const cost = round2(msgs.reduce((s, m) => s + Number(m.cost_tzs), 0));
      await client.query(
        `UPDATE campaigns SET status = 'sending', started_at = now(), total_recipients = $2, cost_tzs = $3 WHERE id = $1`,
        [campaignId, msgs.length, cost],
      );
      return msgs;
    });
  } catch (e: any) {
    if (e?.code === 'insufficient_balance') {
      await query(`UPDATE campaigns SET status = 'failed', completed_at = now(), total_recipients = $2 WHERE id = $1`, [
        campaignId,
        recips.length,
      ]);
      logger.warn({ campaignId }, 'campaign failed: insufficient balance');
      return;
    }
    throw e;
  }
  if (!created) return;
  await enqueueMessages(created.map((m) => m.id));
  logger.info({ campaignId, count: created.length }, 'campaign dispatched');
}

export { insufficientBalance };
