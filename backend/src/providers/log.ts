import crypto from 'node:crypto';
import { logger } from '../logger.js';
import type { ProviderEvents, SendRequest, SendResult, SmsProvider } from './types.js';

/** Prints messages instead of sending; simulates a DELIVRD receipt after 1s. */
export class LogProvider implements SmsProvider {
  readonly name = 'log';
  private events: ProviderEvents = {};

  async start(events: ProviderEvents) {
    this.events = events;
  }

  async send(req: SendRequest): Promise<SendResult> {
    const parts = [req.body];
    const ids = parts.map(() => `log-${crypto.randomUUID()}`);
    logger.info({ to: req.to, from: req.from, parts: parts.length, body: req.body }, '[log provider] SMS');
    setTimeout(() => {
      for (const id of ids) void this.events.onReceipt?.({ providerMessageId: id, stat: 'DELIVRD', err: '000' });
    }, 1000);
    return { providerMessageId: ids[0], providerMessageIds: ids };
  }

  status() {
    return 'bound' as const;
  }

  async stop() {}
}
