/**
 * Textify Africa HTTP API client (https://textify.africa/docs/).
 *
 * Bermi Techs holds ONE Textify account; customers never see Textify. The API key is read from
 * TEXTIFY_API_KEY and is never logged. Every response uses the envelope
 *   { success, status_code, status_text, message, data, error }
 * and lists are paginated with page/limit (max 1000): data = { data: [...], total, page, limit, total_pages }.
 */
import { config } from '../config.js';
import { logger } from '../logger.js';

const log = logger.child({ mod: 'textify-api' });

export class TextifyApiError extends Error {
  constructor(public status: number, public code: string, message: string) {
    super(message);
  }
}

export interface TextifyPage<T> { data: T[]; total: number; page: number; limit: number; total_pages: number }

export type TextifyMessageStatus =
  | 'scheduled' | 'sending' | 'processing' | 'processing_status' | 'sent' | 'delivered' | 'undelivered' | 'failed';

export interface TextifyMessage {
  message_id: string;
  status: TextifyMessageStatus;
  content: string;
  count: number;
  sender_name: string;
  phone_number: string;
  failure_reason: string | null;
  created_at: string;
}

export interface TextifySenderName {
  id: string;
  name: string;
  reason?: string;
  status: 'requested' | 'approved' | 'declined';
  is_default?: boolean;
  created_at?: string;
}

export class TextifyApi {
  constructor(private baseUrl: string, private apiKey: string, private timeoutMs = 20_000) {}

  private async request<T>(method: string, path: string, body?: unknown, query?: Record<string, string | number | undefined>): Promise<T> {
    const qs = query
      ? '?' + new URLSearchParams(Object.entries(query).filter(([, v]) => v !== undefined && v !== '').map(([k, v]) => [k, String(v)])).toString()
      : '';
    let res: Response;
    try {
      res = await fetch(`${this.baseUrl}${path}${qs}`, {
        method,
        headers: { Authorization: `Bearer ${this.apiKey}`, Accept: 'application/json', ...(body ? { 'Content-Type': 'application/json' } : {}) },
        body: body ? JSON.stringify(body) : undefined,
        signal: AbortSignal.timeout(this.timeoutMs),
      });
    } catch (e: any) {
      throw new TextifyApiError(0, 'network_error', `Textify unreachable: ${e?.name === 'TimeoutError' ? 'timeout' : e?.message ?? e}`);
    }
    const json: any = await res.json().catch(() => null);
    if (!res.ok || json?.success === false) {
      const code = String(json?.error?.code ?? json?.error ?? json?.status_text ?? `http_${res.status}`);
      const msg = String(json?.message ?? json?.error?.message ?? `Textify error ${res.status}`);
      log.warn({ method, path, status: res.status, code }, 'textify api error'); // never log headers / key
      throw new TextifyApiError(res.status, code, msg);
    }
    return (json?.data ?? null) as T;
  }

  /* messages */
  sendMessages(b: { sender_name: string; messages: { receiver: string; content: string }[]; is_scheduled?: boolean; scheduled_date?: string | null }) {
    return this.request<null>('POST', '/messages', { is_scheduled: false, scheduled_date: null, ...b });
  }
  listMessages(q: { status?: TextifyMessageStatus; page?: number; limit?: number } = {}) {
    return this.request<TextifyPage<TextifyMessage>>('GET', '/messages', undefined, { page: 1, limit: 1000, ...q });
  }
  searchMessages(search: string, q: { page?: number; limit?: number } = {}) {
    return this.request<TextifyPage<TextifyMessage>>('GET', '/messages/search', undefined, { search, page: 1, limit: 100, ...q });
  }
  getMessage(id: string) {
    return this.request<TextifyMessage>('GET', `/messages/${encodeURIComponent(id)}`);
  }

  /* sender names */
  createSenderName(b: { name: string; reason: string; is_default?: boolean }) {
    return this.request<TextifySenderName | null>('POST', '/sender-names', { is_default: false, ...b });
  }
  listSenderNames(q: { status?: string; page?: number; limit?: number } = {}) {
    return this.request<TextifyPage<TextifySenderName> | TextifySenderName[]>('GET', '/sender-names', undefined, { page: 1, limit: 1000, ...q });
  }
  getSenderName(id: string) {
    return this.request<TextifySenderName>('GET', `/sender-names/${encodeURIComponent(id)}`);
  }

  /**
   * TODO(textify-credits): Textify has a credits/balance API that is not publicly documented yet
   * (docs.textify.africa/credits). Implement this once the shape is published; until then the admin
   * page shows "not available".
   */
  async getBalance(): Promise<{ credits: number } | null> {
    return null;
  }

  /**
   * TODO(textify-webhooks): Textify webhooks (docs.textify.africa/webhooks) are not publicly documented yet.
   * When they are, add POST /v1/inbound/textify-http that verifies the signature and calls finalizeMessage,
   * so the 60s reconcile poller becomes a safety net instead of the main path.
   */
}

/** Rows from a list endpoint whose `data` may be a page object or a bare array. */
export function rowsOf<T>(d: TextifyPage<T> | T[] | null | undefined): T[] {
  if (!d) return [];
  return Array.isArray(d) ? d : Array.isArray(d.data) ? d.data : [];
}

let client: TextifyApi | null | undefined;
/** The Textify client, or null when TEXTIFY_API_KEY is not set. */
export function textifyApi(): TextifyApi | null {
  if (client !== undefined) return client;
  client = config.textify.apiKey ? new TextifyApi(config.textify.apiUrl, config.textify.apiKey) : null;
  return client;
}
