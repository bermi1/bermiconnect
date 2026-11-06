import crypto from 'node:crypto';
import { cleanText } from '../lib/segments.js';
import { toSmppAddr } from '../lib/phone.js';
import { logger } from '../logger.js';
import { TextifyApiError, textifyApi } from '../upstream/textify.js';
import { PermanentSendError, type ProviderEvents, type SendRequest, type SendResult, type SmsProvider } from './types.js';

const log = logger.child({ mod: 'textify-http' });

/** Prefix of provider ids that still need to be matched to a Textify message_id by the reconciler. */
export const HTTP_PENDING_PREFIX = 'txh-pending:';
export const HTTP_MATCHED_PREFIX = 'txh:';

/**
 * Backup route: Textify HTTP API, POST /messages. It returns 201 with data:null (no message ids),
 * so each send gets a local placeholder id and services/textifyReconcile.ts matches it to the Textify
 * message (phone + content + time) every TEXTIFY_POLL_MS, then applies delivered/failed + refunds.
 * SMPP is preferred because it returns ids and real delivery receipts.
 */
export class TextifyHttpProvider implements SmsProvider {
  readonly name = 'textify_http';
  private healthy = true;

  async start(_events: ProviderEvents) {
    if (!textifyApi()) log.error('SMS_PROVIDER=textify_http but TEXTIFY_API_KEY is not set: every send will fail');
  }

  status(): 'bound' | 'down' {
    return textifyApi() && this.healthy ? 'bound' : 'down';
  }

  async send(req: SendRequest): Promise<SendResult> {
    const api = textifyApi();
    if (!api) throw new Error('Textify API key not configured');
    const content = cleanText(req.body);
    try {
      await api.sendMessages({ sender_name: req.from, messages: [{ receiver: toSmppAddr(req.to), content }] });
      this.healthy = true;
    } catch (e) {
      if (e instanceof TextifyApiError) {
        if (e.status === 0 || e.status >= 500 || e.status === 429) { this.healthy = false; throw e; } // retry
        // 400 creation_error can mean "insufficient balance" on Bermi's Textify account: that is ours to fix, so retry.
        if (/balance|credit|insufficient/i.test(e.message)) {
          log.error({ code: e.code }, 'Textify account balance too low: top up the Bermi Textify account');
          throw e;
        }
        throw new PermanentSendError(`textify_${e.code}`.slice(0, 60), e.message);
      }
      throw e;
    }
    const id = `${HTTP_PENDING_PREFIX}${crypto.randomUUID()}`;
    return { providerMessageId: id, providerMessageIds: [id] };
  }

  async stop() {}
}
