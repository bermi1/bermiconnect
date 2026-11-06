/**
 * Bermi Connect SDK for JavaScript / TypeScript.
 * Zero dependencies: uses the global `fetch` (Node 18+, Deno, Bun, browsers)
 * and `node:crypto` / Web Crypto for webhook signatures.
 */

export const VERSION = "1.0.0";
export const DEFAULT_BASE_URL = "https://api.bermiconnect.co.tz/v1";

// ------------------------------------------------------------------ types

export type MessageStatus = "queued" | "sent" | "delivered" | "failed" | "rejected";
export type Encoding = "GSM7" | "UCS2";
export type WebhookEventName =
  | "message.delivered"
  | "message.failed"
  | "campaign.completed"
  | "message.inbound";

export interface SendSmsParams {
  /** One number or up to 1000. Accepts 07xx, 06xx, 2557xx, +2557xx. */
  to: string | string[];
  message: string;
  sender_id?: string;
  reference?: string;
  /** ISO 8601 string or Date in the future. */
  schedule_at?: string | Date;
}

export interface QueuedMessage {
  id: string;
  to: string;
  status: MessageStatus;
  segments: number;
  cost_tzs: number;
}

export interface SendSmsResult {
  batch_id: string;
  messages: QueuedMessage[];
  total_cost_tzs: number;
}

export interface Message {
  id: string;
  account_id: string;
  campaign_id: string | null;
  api_key_id: string | null;
  to_phone: string;
  sender_id: string;
  body: string;
  segments: number;
  encoding: Encoding;
  status: MessageStatus;
  provider_message_id: string | null;
  error_code: string | null;
  cost_tzs: number;
  reference: string | null;
  created_at: string;
  sent_at: string | null;
  delivered_at: string | null;
}

export interface ListSmsParams {
  status?: MessageStatus;
  from?: string | Date;
  to?: string | Date;
  campaign_id?: string;
  page?: number;
  per_page?: number;
}

export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
}

export interface Page<T> {
  data: T[];
  meta: PageMeta;
}

export interface OtpSendParams {
  phone: string;
  sender_id?: string;
  length?: number;
  expires_in?: number;
  /** Must contain {{code}}. */
  template?: string;
}

export interface OtpSendResult {
  otp_id: string;
  expires_at: string;
}

export interface Balance {
  balance_tzs: number;
  price_per_sms_tzs: number;
}

export interface WebhookPayload<T = Record<string, unknown>> {
  event: WebhookEventName;
  data: T;
  created_at: string;
}

export interface ClientOptions {
  /** bc_live_... or bc_test_... */
  apiKey: string;
  baseUrl?: string;
  /** Request timeout in ms (default 30000). */
  timeout?: number;
  /** Retries on 429 / 5xx / network errors for idempotent GETs (default 2). */
  maxRetries?: number;
  /** Custom fetch implementation (for tests or older runtimes). */
  fetch?: typeof fetch;
}

// ------------------------------------------------------------------ errors

export class BermiError extends Error {
  readonly code: string;
  readonly status: number;
  readonly details?: unknown;
  constructor(message: string, code: string, status: number, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.code = code;
    this.status = status;
    this.details = details;
  }
}
export class ValidationError extends BermiError {}
export class AuthenticationError extends BermiError {}
export class InsufficientBalanceError extends BermiError {}
export class ForbiddenError extends BermiError {}
export class NotFoundError extends BermiError {}
export class ConflictError extends BermiError {}
export class SenderNotApprovedError extends BermiError {}
export class RateLimitError extends BermiError {
  readonly retryAfter?: number;
  constructor(message: string, code: string, status: number, details?: unknown, retryAfter?: number) {
    super(message, code, status, details);
    this.retryAfter = retryAfter;
  }
}
export class ApiError extends BermiError {}
export class ConnectionError extends BermiError {}

const ERROR_BY_CODE: Record<string, typeof BermiError> = {
  validation_error: ValidationError,
  unauthorized: AuthenticationError,
  insufficient_balance: InsufficientBalanceError,
  forbidden: ForbiddenError,
  not_found: NotFoundError,
  conflict: ConflictError,
  sender_not_approved: SenderNotApprovedError,
};
const ERROR_BY_STATUS: Record<number, typeof BermiError> = {
  400: ValidationError,
  401: AuthenticationError,
  402: InsufficientBalanceError,
  403: ForbiddenError,
  404: NotFoundError,
  409: ConflictError,
  422: SenderNotApprovedError,
};

// ------------------------------------------------------------------ helpers

/** Normalise a Tanzanian / international number to E.164. Returns null if invalid. */
export function normalizePhone(input: string, defaultCountry = "255"): string | null {
  let s = String(input).trim().replace(/[\s\-().]/g, "");
  if (s.startsWith("00")) s = "+" + s.slice(2);
  if (s.startsWith("+")) {
    return /^\+[1-9]\d{7,14}$/.test(s) ? s : null;
  }
  if (!/^\d+$/.test(s)) return null;
  if (s.startsWith(defaultCountry) && s.length === defaultCountry.length + 9) return "+" + s;
  if (s.startsWith("0") && s.length === 10) return "+" + defaultCountry + s.slice(1);
  if (/^[67]\d{8}$/.test(s)) return "+" + defaultCountry + s;
  return null;
}

const GSM7 =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM7_EXT = "^{}\\[~]|€\f";

/** Count SMS segments the same way the API bills them. */
export function countSegments(text: string): { encoding: Encoding; segments: number; length: number } {
  let septets = 0;
  let gsm = true;
  for (const ch of text) {
    if (GSM7.includes(ch)) septets += 1;
    else if (GSM7_EXT.includes(ch)) septets += 2;
    else { gsm = false; break; }
  }
  if (gsm) {
    return { encoding: "GSM7", length: septets, segments: septets === 0 ? 0 : septets <= 160 ? 1 : Math.ceil(septets / 153) };
  }
  // UCS-2 counts UTF-16 code units (emoji = 2)
  const units = text.length;
  return { encoding: "UCS2", length: units, segments: units <= 70 ? 1 : Math.ceil(units / 67) };
}

function toIso(v: string | Date | undefined): string | undefined {
  if (v === undefined) return undefined;
  return v instanceof Date ? v.toISOString() : v;
}

function timingSafeEqualStr(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

async function hmacSha256Hex(secret: string, body: string | Uint8Array): Promise<string> {
  const enc = new TextEncoder();
  const data = typeof body === "string" ? enc.encode(body) : body;
  const subtle = (globalThis.crypto as Crypto | undefined)?.subtle;
  if (subtle) {
    const key = await subtle.importKey("raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const sig = new Uint8Array(await subtle.sign("HMAC", key, data as BufferSource));
    return Array.from(sig, (b) => b.toString(16).padStart(2, "0")).join("");
  }
  const { createHmac } = await import("node:crypto");
  return createHmac("sha256", secret).update(data).digest("hex");
}

// ------------------------------------------------------------------ client

type Query = Record<string, string | number | undefined>;

type HttpOptions = Required<Omit<ClientOptions, "fetch">> & { fetch: typeof fetch };

class HttpClient {
  private readonly opts: HttpOptions;
  constructor(opts: HttpOptions) {
    this.opts = opts;
  }

  async request<T>(method: string, path: string, body?: unknown, query?: Query): Promise<{ data: T; meta?: PageMeta }> {
    const url = new URL(this.opts.baseUrl.replace(/\/+$/, "") + path);
    if (query) for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== "") url.searchParams.set(k, String(v));

    const retries = method === "GET" ? this.opts.maxRetries : 0;
    let attempt = 0;
    for (;;) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), this.opts.timeout);
      let res: Response;
      try {
        res = await this.opts.fetch(url.toString(), {
          method,
          headers: {
            Authorization: `Bearer ${this.opts.apiKey}`,
            Accept: "application/json",
            ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            "User-Agent": `bermi-connect-js/${VERSION}`,
          },
          body: body !== undefined ? JSON.stringify(body) : undefined,
          signal: ctrl.signal,
        });
      } catch (err) {
        clearTimeout(timer);
        if (attempt < retries) { await sleep(backoff(attempt++)); continue; }
        throw new ConnectionError((err as Error)?.message ?? "Network error", "connection_error", 0);
      }
      clearTimeout(timer);

      const text = await res.text();
      let json: any = undefined;
      try { json = text ? JSON.parse(text) : undefined; } catch { /* non-JSON */ }

      if (res.ok) return { data: json?.data as T, meta: json?.meta };

      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        const ra = Number(res.headers.get("retry-after"));
        await sleep(Number.isFinite(ra) && ra > 0 ? ra * 1000 : backoff(attempt));
        attempt++;
        continue;
      }
      throw buildError(res, json);
    }
  }
}

function buildError(res: Response, json: any): BermiError {
  const code: string = json?.error?.code ?? (res.status === 429 ? "rate_limited" : "api_error");
  const message: string = json?.error?.message ?? `HTTP ${res.status}`;
  const details = json?.error?.details;
  if (code === "rate_limited" || res.status === 429) {
    const ra = Number(res.headers.get("retry-after"));
    return new RateLimitError(message, code, res.status, details, Number.isFinite(ra) ? ra : undefined);
  }
  const Cls = ERROR_BY_CODE[code] ?? ERROR_BY_STATUS[res.status] ?? ApiError;
  return new Cls(message, code, res.status, details);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const backoff = (n: number) => Math.min(250 * 2 ** n, 4000);

export class BermiConnect {
  readonly sms: {
    send(params: SendSmsParams): Promise<SendSmsResult>;
    get(id: string): Promise<Message>;
    list(params?: ListSmsParams): Promise<Page<Message>>;
  };
  readonly otp: {
    send(params: OtpSendParams): Promise<OtpSendResult>;
    verify(otpId: string, code: string): Promise<boolean>;
  };
  readonly balance: { get(): Promise<Balance> };
  readonly webhooks: {
    verifySignature(rawBody: string | Uint8Array, signatureHeader: string | null | undefined, secret: string): Promise<boolean>;
  };
  /** True when using a bc_test_ key (no real sends, no charge). */
  readonly testMode: boolean;

  constructor(options: ClientOptions | string) {
    const o: ClientOptions = typeof options === "string" ? { apiKey: options } : options;
    if (!o?.apiKey) throw new Error("BermiConnect: apiKey is required");
    const f = o.fetch ?? globalThis.fetch;
    if (!f) throw new Error("BermiConnect: no fetch available; pass options.fetch");
    const http = new HttpClient({
      apiKey: o.apiKey,
      baseUrl: o.baseUrl ?? DEFAULT_BASE_URL,
      timeout: o.timeout ?? 30_000,
      maxRetries: o.maxRetries ?? 2,
      fetch: f.bind(globalThis),
    });
    this.testMode = o.apiKey.startsWith("bc_test_");

    this.sms = {
      send: async (p) =>
        (await http.request<SendSmsResult>("POST", "/sms/send", { ...p, schedule_at: toIso(p.schedule_at) })).data,
      get: async (id) => (await http.request<Message>("GET", `/sms/${encodeURIComponent(id)}`)).data,
      list: async (p = {}) => {
        const r = await http.request<Message[]>("GET", "/sms", undefined, {
          status: p.status, from: toIso(p.from), to: toIso(p.to), campaign_id: p.campaign_id, page: p.page, per_page: p.per_page,
        });
        return { data: r.data, meta: r.meta ?? { page: p.page ?? 1, per_page: p.per_page ?? 50, total: r.data.length } };
      },
    };
    this.otp = {
      send: async (p) => (await http.request<OtpSendResult>("POST", "/otp/send", p)).data,
      verify: async (otp_id, code) => (await http.request<{ verified: boolean }>("POST", "/otp/verify", { otp_id, code })).data.verified,
    };
    this.balance = { get: async () => (await http.request<Balance>("GET", "/balance")).data };
    this.webhooks = { verifySignature: BermiConnect.verifySignature };
  }

  /**
   * Verify an `X-Bermi-Signature: sha256=<hex>` header against the RAW request body.
   * Do not re-serialise parsed JSON: whitespace changes break the signature.
   */
  static async verifySignature(rawBody: string | Uint8Array, signatureHeader: string | null | undefined, secret: string): Promise<boolean> {
    if (!signatureHeader || !secret) return false;
    const provided = signatureHeader.trim().replace(/^sha256=/i, "").toLowerCase();
    const expected = await hmacSha256Hex(secret, rawBody);
    return timingSafeEqualStr(provided, expected);
  }
}

export default BermiConnect;
