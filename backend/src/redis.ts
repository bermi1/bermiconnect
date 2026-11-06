import { Redis } from 'ioredis';
import { config } from './config.js';

/** Shared general-purpose Redis client (rate limits, smpp status, etc). */
export const redis = new Redis(config.redisUrl, { maxRetriesPerRequest: 3, lazyConnect: false });

/** Connection options for BullMQ (it creates its own connections). */
export function bullConnection() {
  const u = new URL(config.redisUrl);
  return {
    host: u.hostname,
    port: Number(u.port || 6379),
    username: u.username || undefined,
    password: u.password ? decodeURIComponent(u.password) : undefined,
    db: u.pathname && u.pathname.length > 1 ? Number(u.pathname.slice(1)) : 0,
    tls: u.protocol === 'rediss:' ? {} : undefined,
    maxRetriesPerRequest: null,
  };
}

export const SMPP_STATUS_KEY = 'bermi:smpp:status';
