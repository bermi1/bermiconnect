import { config } from '../config.js';
import { queryOne } from '../db.js';
import { senderNotApproved } from '../errors.js';

/** Resolve and validate a sender ID for an account. DEFAULT_SENDER_ID is always allowed. */
export async function resolveSenderId(accountId: string, requested?: string | null): Promise<string> {
  const name = (requested ?? '').trim();
  if (!name || name.toUpperCase() === config.defaultSenderId.toUpperCase()) return config.defaultSenderId;
  const row = await queryOne<{ name: string }>(
    `SELECT name FROM sender_ids WHERE account_id = $1 AND upper(name) = upper($2) AND status = 'approved'`,
    [accountId, name],
  );
  if (!row) throw senderNotApproved(name);
  return row.name;
}
