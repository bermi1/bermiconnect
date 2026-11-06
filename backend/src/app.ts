import cors from 'cors';
import express from 'express';
import { config } from './config.js';
import { errorHandler, notFoundHandler } from './errors.js';
import { logger } from './logger.js';
import { aiRouter } from './routes/ai.js';
import { accountRouter } from './routes/account.js';
import { authRouter } from './routes/auth.js';
import { campaignsRouter } from './routes/campaigns.js';
import { contactsRouter } from './routes/contacts.js';
import { inboxRouter } from './routes/inbox.js';
import { publicRouter } from './routes/public.js';
import { smsRouter } from './routes/sms.js';

export function createApp() {
  const app = express();
  app.disable('x-powered-by');
  app.set('trust proxy', 1);

  const origins = config.corsOrigins === '*' ? true : config.corsOrigins.split(',').map((s) => s.trim());
  app.use(
    cors({
      origin: origins,
      credentials: false,
      exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset', 'Retry-After'],
    }),
  );
  // Send from Excel posts up to 10,000 pre-rendered rows; give that one route more room.
  app.use('/v1/campaigns/from-file', express.json({ limit: '25mb' }));
  app.use(express.json({ limit: '2mb' }));
  app.use(express.urlencoded({ extended: true, limit: '2mb' }));
  app.use((req, res, next) => {
    const t = Date.now();
    res.on('finish', () => logger.info({ m: req.method, p: req.originalUrl, s: res.statusCode, ms: Date.now() - t }, 'http'));
    next();
  });

  app.get('/', (_req, res) => res.json({ data: { name: 'Bermi Connect API', version: 'v1', docs: '/v1/health' } }));
  app.get('/health', (_req, res) => res.redirect(307, '/v1/health'));

  const v1 = express.Router();
  v1.use(publicRouter);
  v1.use(authRouter);
  v1.use(smsRouter);
  v1.use(contactsRouter);
  v1.use(campaignsRouter);
  v1.use(accountRouter);
  v1.use(inboxRouter);
  v1.use(aiRouter);
  app.use('/v1', v1);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
