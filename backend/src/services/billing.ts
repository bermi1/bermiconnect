import type { PoolClient } from 'pg';
import { insufficientBalance, notFound } from '../errors.js';

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Lock the account row for the duration of the transaction and return the current balance. */
export async function lockAccount(client: PoolClient, accountId: string): Promise<number> {
  const r = await client.query<{ balance_tzs: number }>('SELECT balance_tzs FROM accounts WHERE id = $1 FOR UPDATE', [accountId]);
  if (!r.rows[0]) throw notFound('Account');
  return Number(r.rows[0].balance_tzs);
}

/**
 * Debit the account (must be called inside a transaction). Throws 402 when the balance is too low.
 * Returns the new balance.
 */
export async function charge(
  client: PoolClient,
  accountId: string,
  amount: number,
  description: string,
  reference: string | null,
): Promise<number> {
  amount = round2(amount);
  const balance = await lockAccount(client, accountId);
  if (amount <= 0) return balance;
  if (balance < amount) throw insufficientBalance(amount, balance);
  const r = await client.query<{ balance_tzs: number }>(
    'UPDATE accounts SET balance_tzs = balance_tzs - $2 WHERE id = $1 RETURNING balance_tzs',
    [accountId, amount],
  );
  const after = Number(r.rows[0].balance_tzs);
  await client.query(
    `INSERT INTO transactions (account_id, type, amount_tzs, balance_after, description, reference)
     VALUES ($1, 'charge', $2, $3, $4, $5)`,
    [accountId, -amount, after, description, reference],
  );
  return after;
}

/** Credit the account (topup / refund / bonus). Must be called inside a transaction. */
export async function credit(
  client: PoolClient,
  accountId: string,
  amount: number,
  type: 'topup' | 'refund' | 'bonus',
  description: string,
  reference: string | null,
  method: string | null = null,
): Promise<number> {
  amount = round2(amount);
  await lockAccount(client, accountId);
  const r = await client.query<{ balance_tzs: number }>(
    'UPDATE accounts SET balance_tzs = balance_tzs + $2 WHERE id = $1 RETURNING balance_tzs',
    [accountId, amount],
  );
  const after = Number(r.rows[0].balance_tzs);
  await client.query(
    `INSERT INTO transactions (account_id, type, amount_tzs, balance_after, description, reference, method)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [accountId, type, amount, after, description, reference, method],
  );
  return after;
}
