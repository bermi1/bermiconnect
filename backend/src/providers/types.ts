import type { Encoding } from '../lib/segments.js';

export interface SendRequest {
  to: string; // E.164
  from: string; // sender id
  body: string;
  encoding: Encoding;
}

export interface SendResult {
  /** Provider id of the first (or only) part. */
  providerMessageId: string;
  /** One id per submitted part (concatenated SMS). */
  providerMessageIds: string[];
}

export interface DeliveryReceipt {
  providerMessageId: string;
  stat: string; // DELIVRD, UNDELIV, ...
  err: string | null;
}

export interface InboundSms {
  from: string;
  to: string;
  body: string;
}

export interface ProviderEvents {
  onReceipt?: (r: DeliveryReceipt) => Promise<void> | void;
  onInbound?: (m: InboundSms) => Promise<void> | void;
}

export interface SmsProvider {
  readonly name: string;
  start(events: ProviderEvents): Promise<void>;
  send(req: SendRequest): Promise<SendResult>;
  status(): 'bound' | 'down';
  stop(): Promise<void>;
}

/** Error that should not be retried (e.g. invalid destination). */
export class PermanentSendError extends Error {
  constructor(public code: string, message: string) {
    super(message);
  }
}
