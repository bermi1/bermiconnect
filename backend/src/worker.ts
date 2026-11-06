import { UnrecoverableError, Worker, type Job } from 'bullmq';
import { config } from './config.js';
import { pool, queryOne } from './db.js';
import { logger } from './logger.js';
import { getProvider, PermanentSendError } from './providers/index.js';
import { closeQueues, QUEUE_CAMPAIGN, QUEUE_SMS, QUEUE_WEBHOOKS, type CampaignJob, type SmsJob, type WebhookJob } from './queues.js';
import { bullConnection, redis, SMPP_STATUS_KEY } from './redis.js';
import { dispatchCampaign } from './services/campaigns.js';
import { applyReceipt, finalizeMessage, getMessage, handleInbound, markSent, sweepStaleCampaigns } from './services/messages.js';
import { deliver } from './services/webhooks.js';
import { syncSenderNames } from './services/senderSync.js';
import { reconcileTextifyHttp } from './services/textifyReconcile.js';
import { textifyApi } from './upstream/textify.js';

const provider = getProvider();

async function processSms(job: Job<SmsJob>) {
  const m = await getMessage(job.data.messageId);
  if (!m || m.status !== 'queued') return { skipped: true };

  if (m.test_mode) {
    // Test keys: never hit the provider; simulate delivery.
    await markSent(m.id, [`test-${m.id}`]);
    setTimeout(() => void finalizeMessage(m.id, 'delivered').catch((err) => logger.error({ err }, 'test dlr')), 500);
    return { test: true };
  }

  // Skip contacts that opted out after enqueue
  const opted = await queryOne<{ opted_out: boolean }>(
    'SELECT opted_out FROM contacts WHERE account_id = $1 AND phone = $2',
    [m.account_id, m.to_phone],
  );
  if (opted?.opted_out) {
    await finalizeMessage(m.id, 'rejected', 'opted_out');
    return { rejected: 'opted_out' };
  }

  try {
    const r = await provider.send({ to: m.to_phone, from: m.sender_id, body: m.body, encoding: m.encoding });
    await markSent(m.id, r.providerMessageIds);
    return { providerMessageId: r.providerMessageId };
  } catch (e: any) {
    if (e instanceof PermanentSendError) {
      await finalizeMessage(m.id, 'rejected', e.code);
      throw new UnrecoverableError(e.message);
    }
    const last = job.attemptsMade + 1 >= (job.opts.attempts ?? 1);
    if (last) await finalizeMessage(m.id, 'rejected', 'provider_unavailable');
    throw e;
  }
}

async function processWebhook(job: Job<WebhookJob>) {
  const hook = await queryOne<{ url: string; secret: string; active: boolean }>(
    'SELECT url, secret, active FROM webhooks WHERE id = $1',
    [job.data.webhookId],
  );
  if (!hook || !hook.active) return { skipped: true };
  const r = await deliver(hook.url, hook.secret, job.data.event, job.data.body, job.data.deliveryId);
  if (!r.ok) throw new Error(`webhook ${hook.url} failed: ${r.status ?? r.error}`);
  return { status: r.status };
}

async function main() {
  await provider.start({
    onReceipt: async (r) => {
      await applyReceipt(r.providerMessageId, r.stat, r.err);
    },
    onInbound: async (m) => {
      await handleInbound(m.from, m.to, m.body);
    },
  });

  const statusTimer = setInterval(() => {
    redis.set(SMPP_STATUS_KEY, provider.status(), 'EX', 15).catch(() => {});
  }, 5000);
  await redis.set(SMPP_STATUS_KEY, provider.status(), 'EX', 15).catch(() => {});
  // Textify HTTP route: match sends to Textify messages and apply final statuses
  const pollTimer = config.smsProvider === 'textify_http'
    ? setInterval(() => void reconcileTextifyHttp().catch((err) => logger.warn({ err: err?.message }, 'reconcile failed')), config.textify.pollMs)
    : null;
  // Sender names: pull Textify approvals
  const senderTimer = textifyApi()
    ? setInterval(() => void syncSenderNames().catch(() => {}), config.textify.senderSyncMs)
    : null;
  if (senderTimer) void syncSenderNames().catch(() => {});
  const sweepTimer = setInterval(() => void sweepStaleCampaigns().catch((err) => logger.error({ err }, 'sweep failed')), 3600_000);

  const smsWorker = new Worker<SmsJob>(QUEUE_SMS, processSms, {
    connection: bullConnection(),
    concurrency: config.workerConcurrency,
    // global queue limiter as a second guard; the SMPP throttle handles per-PDU TPS
    limiter: { max: config.smpp.tps, duration: 1000 },
  });
  const campaignWorker = new Worker<CampaignJob>(QUEUE_CAMPAIGN, (job) => dispatchCampaign(job.data.campaignId), {
    connection: bullConnection(),
    concurrency: 2,
  });
  const webhookWorker = new Worker<WebhookJob>(QUEUE_WEBHOOKS, processWebhook, {
    connection: bullConnection(),
    concurrency: 10,
  });

  for (const w of [smsWorker, campaignWorker, webhookWorker]) {
    w.on('failed', (job, err) => logger.warn({ queue: w.name, jobId: job?.id, attempts: job?.attemptsMade, err: err.message }, 'job failed'));
    w.on('error', (err) => logger.error({ queue: w.name, err }, 'worker error'));
  }
  logger.info({ provider: provider.name, tps: config.smpp.tps }, 'Bermi Connect workers started');

  const shutdown = async () => {
    logger.info('shutting down workers');
    clearInterval(statusTimer);
    clearInterval(sweepTimer);
    if (pollTimer) clearInterval(pollTimer);
    if (senderTimer) clearInterval(senderTimer);
    await Promise.allSettled([smsWorker.close(), campaignWorker.close(), webhookWorker.close()]);
    await provider.stop();
    await closeQueues();
    await pool.end();
    redis.disconnect();
    process.exit(0);
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}

main().catch((err) => {
  logger.fatal({ err }, 'worker crashed');
  process.exit(1);
});
