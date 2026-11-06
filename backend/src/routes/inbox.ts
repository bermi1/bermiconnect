import { Router } from 'express';
import { query, queryOne } from '../db.js';
import { ok, pagination } from '../lib/http.js';
import { acc, auth } from '../middleware/auth.js';

/** Not in spec: lets the dashboard show replies / STOP messages. */
export const inboxRouter = Router();

inboxRouter.get('/inbound', auth('dashboard'), async (req, res) => {
  const { page, per_page, offset, limit } = pagination(req.query);
  const total = await queryOne<{ n: number }>('SELECT count(*)::int AS n FROM inbound_messages WHERE account_id = $1', [acc(req)]);
  const rows = await query(
    `SELECT id, from_phone AS "from", "to", body, received_at FROM inbound_messages WHERE account_id = $1
     ORDER BY received_at DESC LIMIT ${limit} OFFSET ${offset}`,
    [acc(req)],
  );
  ok(res, rows, 200, { page, per_page, total: total?.n ?? 0 });
});
