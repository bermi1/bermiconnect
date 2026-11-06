import { Queue } from 'bullmq';
import { bullConnection } from './redis.js';

export const QUEUE_SMS = 'sms-send';
export const QUEUE_CAMPAIGN = 'campaign-dispatch';
export const QUEUE_WEBHOOKS = 'webhooks';

export interface SmsJob {
  messageId: string;
}
export interface TestDlrJob {
  messageId: string;
  testDlr: true;
}
export interface CampaignJob {
  campaignId: string;
}
export interface WebhookJob {
  webhookId: string;
  event: string;
  body: string; // exact JSON string that is signed
  deliveryId: string;
}

let _sms: Queue | null = null;
let _campaign: Queue | null = null;
let _webhooks: Queue | null = null;

export function smsQueue(): Queue {
  return (_sms ??= new Queue(QUEUE_SMS, {
    connection: bullConnection(),
    defaultJobOptions: {
      // ~10 attempts with exponential backoff (2s..17min) rides out SMSC outages of ~30 min
      attempts: 10,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { age: 3600, count: 10000 },
      removeOnFail: { age: 24 * 3600 },
    },
  }));
}

export function campaignQueue(): Queue {
  return (_campaign ??= new Queue(QUEUE_CAMPAIGN, {
    connection: bullConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 24 * 3600 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }));
}

export function webhookQueue(): Queue {
  return (_webhooks ??= new Queue(QUEUE_WEBHOOKS, {
    connection: bullConnection(),
    defaultJobOptions: {
      attempts: 6, // first try + 5 retries
      backoff: { type: 'exponential', delay: 30_000 }, // 30s, 60s, 2m, 4m, 8m
      removeOnComplete: { age: 24 * 3600, count: 5000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  }));
}

export const campaignJobId = (campaignId: string) => `campaign-${campaignId}`;

export async function closeQueues() {
  await Promise.all([_sms?.close(), _campaign?.close(), _webhooks?.close()]);
}
