import crypto from 'node:crypto';
import { config } from '../config.js';
import { query, queryOne, tx } from '../db.js';
import { badRequest, notFound } from '../errors.js';
import { logger } from '../logger.js';
import { getPaymentProvider, isMobile, type PaymentMethod } from '../payments/index.js';
import { credit, round2 } from './billing.js';

export interface Tier { min_sms: number; price_tzs: number }

/** SMS_PRICE_TIERS="1:18,10000:16" -> per-SMS price by volume. Default: one tier at SMS_PRICE_TZS. */
export function priceTiers(spec = config.smsPriceTiers): Tier[] {
  const tiers = spec
    .split(',')
    .map((p) => p.split(':').map((x) => Number(x.trim())))
    .filter(([a, b]) => a > 0 && b > 0)
    .map(([min_sms, price_tzs]) => ({ min_sms, price_tzs }))
    .sort((a, b) => a.min_sms - b.min_sms);
  if (!tiers.length || tiers[0].min_sms > 1) tiers.unshift({ min_sms: 1, price_tzs: config.smsPriceTzs });
  return tiers;
}

export const MIN_SMS = 100;
export const MAX_SMS = 2_000_000;

/** What `sms` costs. The wallet is always credited sms x SMS_PRICE_TZS; volume discounts become a bonus. */
export function quote(sms: number, tiers = priceTiers()) {
  const tier = [...tiers].reverse().find((t) => sms >= t.min_sms) ?? tiers[0];
  const amount = round2(sms * tier.price_tzs);
  const creditTzs = round2(sms * config.smsPriceTzs);
  return { sms, price_per_sms_tzs: tier.price_tzs, amount_tzs: amount, credit_tzs: creditTzs, bonus_tzs: round2(Math.max(0, creditTzs - amount)) };
}

export const PAYMENT_COLS = `id, reference, provider, method, phone, sms_count, amount_tzs, credit_tzs, status, checkout_url, instructions,
  failure_reason, created_at, completed_at`;

export async function createPayment(accountId: string, sms: number, method: PaymentMethod, phone: string | null) {
  if (!Number.isInteger(sms) || sms < MIN_SMS || sms > MAX_SMS) throw badRequest(`Buy between ${MIN_SMS} and ${MAX_SMS.toLocaleString()} SMS`);
  if (isMobile(method) && !phone) throw badRequest('Enter the mobile money number that will approve the payment');
  const q = quote(sms);
  const provider = getPaymentProvider();
  const reference = `BC-${Date.now().toString(36).toUpperCase()}-${crypto.randomBytes(2).toString('hex').toUpperCase()}`;
  const init = await provider.initiate({ amount: q.amount_tzs, phone, method, reference, accountId });
  const p = await queryOne<{ id: string }>(
    `INSERT INTO payments (account_id, reference, provider, method, phone, sms_count, amount_tzs, credit_tzs, checkout_url, instructions, provider_ref)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id`,
    [accountId, reference, provider.name, method, phone, sms, q.amount_tzs, q.credit_tzs, init.checkout_url ?? null, init.instructions ?? null, init.provider_ref ?? null],
  );
  if (init.status === 'completed') await confirmPayment(reference, 'completed');
  return getPayment(accountId, p!.id);
}

/** Mark a payment completed (credit once) or failed. Idempotent. */
export async function confirmPayment(reference: string, status: 'completed' | 'failed', reason?: string) {
  return tx(async (c) => {
    const r = await c.query<any>('SELECT * FROM payments WHERE reference = $1 FOR UPDATE', [reference]);
    const p = r.rows[0];
    if (!p) throw notFound('Payment');
    if (p.status !== 'pending') return p;
    if (status === 'failed') {
      await c.query(`UPDATE payments SET status = 'failed', failure_reason = $2, completed_at = now() WHERE id = $1`, [p.id, reason ?? 'declined']);
      return p;
    }
    const paid = Number(p.amount_tzs);
    const bonus = round2(Number(p.credit_tzs) - paid);
    await credit(c, p.account_id, paid, 'topup', `Bought ${Number(p.sms_count).toLocaleString('en-US')} SMS via ${p.method}`, p.reference, p.method);
    if (bonus > 0) await credit(c, p.account_id, bonus, 'bonus', `Volume bonus on ${p.reference}`, p.reference, p.method);
    await c.query(`UPDATE payments SET status = 'completed', completed_at = now() WHERE id = $1`, [p.id]);
    logger.info({ reference, amount: paid }, 'payment completed');
    return p;
  });
}

export async function getPayment(accountId: string, id: string) {
  let p = await queryOne<any>(`SELECT ${PAYMENT_COLS} FROM payments WHERE id = $1 AND account_id = $2`, [id, accountId]);
  if (!p) throw notFound('Payment');
  // Sandbox: the "customer" approves on their phone a few seconds later.
  if (p.status === 'pending' && p.provider === 'sandbox' && !config.isProd
    && Date.now() - new Date(p.created_at).getTime() >= config.payments.sandboxConfirmMs) {
    await confirmPayment(p.reference, p.phone?.endsWith('0000') ? 'failed' : 'completed', p.phone?.endsWith('0000') ? 'Payment declined (sandbox test number)' : undefined);
    p = await queryOne<any>(`SELECT ${PAYMENT_COLS} FROM payments WHERE id = $1`, [id]);
  }
  const bal = await queryOne<{ balance_tzs: number }>('SELECT balance_tzs FROM accounts WHERE id = $1', [accountId]);
  return { ...p, balance_tzs: bal?.balance_tzs };
}

export async function listPayments(accountId: string, limit = 20) {
  return query(`SELECT ${PAYMENT_COLS} FROM payments WHERE account_id = $1 ORDER BY created_at DESC LIMIT $2`, [accountId, limit]);
}
