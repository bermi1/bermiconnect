/**
 * Payment providers for "Buy SMS".
 *
 *   initiate({amount, phone, method, reference}) -> {status:'pending'|'completed', checkout_url?, instructions?}
 *   confirm: POST /v1/payments/webhook/:provider  (services/payments.ts confirmPayment)
 *
 * Shipped:
 *   - sandbox: non-production only. Card completes at once; mobile money stays "pending" (the
 *     customer would approve on their phone) and confirms itself PAYMENT_SANDBOX_CONFIRM_MS later.
 *   - textify: stub. Textify offers mobile-money collection to partners, but its credits/collection API
 *     is not public yet. TODO(textify-payments): implement initiate() + webhook verification when documented.
 * Alternatives if Textify collection is not available: Selcom (Checkout API, push USSD) or AzamPay
 * (MNO checkout). Each is a new file implementing PaymentProvider and one case in getPaymentProvider().
 */
import { config } from '../config.js';
import { ApiError } from '../errors.js';

export const PAYMENT_METHODS = [
  { id: 'mpesa', label: 'M-Pesa', kind: 'mobile' },
  { id: 'airtel', label: 'Airtel Money', kind: 'mobile' },
  { id: 'mixx', label: 'Mixx by Yas', kind: 'mobile' },
  { id: 'halopesa', label: 'HaloPesa', kind: 'mobile' },
  { id: 'tpesa', label: 'T-Pesa', kind: 'mobile' },
  { id: 'card', label: 'Visa / Mastercard', kind: 'card' },
] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]['id'] | 'manual';
export const isMobile = (m: string) => PAYMENT_METHODS.some((x) => x.id === m && x.kind === 'mobile');

export interface InitiateRequest {
  amount: number;
  phone: string | null;
  method: PaymentMethod;
  reference: string;
  accountId: string;
}
export interface InitiateResult {
  status: 'pending' | 'completed';
  checkout_url?: string;
  instructions?: string;
  provider_ref?: string;
}

export interface PaymentProvider {
  readonly name: string;
  initiate(r: InitiateRequest): Promise<InitiateResult>;
  /** Verify a gateway callback and return {reference, status}. Throw on a bad signature. */
  parseWebhook(headers: Record<string, string | string[] | undefined>, body: any): Promise<{ reference: string; status: 'completed' | 'failed'; provider_ref?: string; reason?: string }>;
}

const sandbox: PaymentProvider = {
  name: 'sandbox',
  async initiate(r) {
    if (config.isProd) throw new ApiError(503, 'payments_not_configured', 'Payments are not set up yet. Contact Bermi Techs support to buy SMS.');
    if (r.method === 'card') return { status: 'completed', instructions: 'Sandbox card payment approved.', provider_ref: `SBX-${r.reference}` };
    return {
      status: 'pending',
      provider_ref: `SBX-${r.reference}`,
      instructions: `Check your phone ${r.phone}: approve the payment of TZS ${r.amount.toLocaleString('en-US')} and enter your PIN. (Sandbox: approves itself in a few seconds.)`,
    };
  },
  async parseWebhook(_h, body) {
    if (config.isProd) throw new ApiError(403, 'forbidden', 'Sandbox webhooks are disabled in production');
    return { reference: String(body?.reference ?? ''), status: body?.status === 'failed' ? 'failed' : 'completed', reason: body?.reason };
  },
};

const textify: PaymentProvider = {
  name: 'textify',
  async initiate() {
    // TODO(textify-payments): call Textify's partner collection API (push USSD to r.phone for r.amount,
    // order id r.reference) once Bermi has the documentation; return status 'pending' + instructions.
    throw new ApiError(503, 'payments_not_configured', 'Mobile money through Textify is not connected yet.');
  },
  async parseWebhook() {
    // TODO(textify-payments): verify Textify's signature header and map its status.
    throw new ApiError(501, 'not_implemented', 'Textify payment callbacks are not implemented yet');
  },
};

export function getPaymentProvider(name = config.payments.provider): PaymentProvider {
  return name === 'textify' ? textify : sandbox;
}
