import { createApp } from './app.js';
import { config } from './config.js';
import { pool } from './db.js';
import { logger } from './logger.js';
import { closeQueues } from './queues.js';
import { redis } from './redis.js';

const app = createApp();
const server = app.listen(config.port, () => {
  logger.info({ port: config.port, env: config.nodeEnv }, 'Bermi Connect API listening');
});

async function shutdown() {
  logger.info('shutting down API');
  server.close();
  await closeQueues().catch(() => {});
  await pool.end().catch(() => {});
  redis.disconnect();
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
