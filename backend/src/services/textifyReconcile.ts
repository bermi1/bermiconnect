/**
 * Reconciler for the Textify HTTP route (no message ids are returned by POST /messages).
 * Every TEXTIFY_POLL_MS it lists recent Textify messages and matches local 'sent' messages by
 * phone number + content + created time, then marks them delivered / failed (refund + webhooks
 * happen in finalizeMessage).
 */
import { query, queryOne } from '../db.js';
import { logger } from '../logger.js';
import { HTTP_MATCHED_PREFIX, HTTP_PENDING_PREFIX } from '../providers/textifyHttp.js';
import { rowsOf, textifyApi, type TextifyMessage } from '../upstream/textify.js';
import { finalizeMessage } from './messages.js';

const log = logger.child({ mod: 'textify-reconcile' });

const FINAL_OK = new Set(['delivered']);
const FINAL_BAD = new Set(['undelivered', 'failed']);
const digits = (s: string) => s.replace(/\D/g, '');
const MATCH_WINDOW_MS = 10 * 60_000;

interface Pending { id: string; to_phone: string; body: string; sent_at: Date; provider_message_id: string }

export async function reconcileTextifyHttp(maxPages = 5): Promise<{ checked: number; matched: number; finalized: number }> {
  const api = textifyApi();
  if (!api) return { checked: 0, matched: 0, finalized: 0 };
  const pending = await query<Pending>(
    `SELECT id, to_phone, body, sent_at, provider_message_id FROM messages
     WHERE status = 'sent' AND test_mode = false
       AND (provider_message_id LIKE '${HTTP_PENDING_PREFIX}%' OR provider_message_id LIKE '${HTTP_MATCHED_PREFIX}%')
       AND sent_at > now() - interval '72 hours'
     ORDER BY sent_at LIMIT 5000`,
  );
  if (!pending.length) return { checked: 0, matched: 0, finalized: 0 };
  const oldest = Math.min(...pending.map((p) => new Date(p.sent_at).getTime())) - MATCH_WINDOW_MS;

  // recent upstream messages, newest first, until we pass the oldest pending local message
  const upstream: TextifyMessage[] = [];
  for (let page = 1; page <= maxPages; page++) {
    const r = await api.listMessages({ page, limit: 1000 });
    const rows = rowsOf(r);
    upstream.push(...rows);
    const last = rows.at(-1);
    if (!rows.length || (r && !Array.isArray(r) && page >= (r.total_pages ?? 1))) break;
    if (last && new Date(last.created_at).getTime() < oldest) break;
  }
  const byId = new Map(upstream.map((u) => [String(u.message_id), u]));
  const claimed = new Set(
    (await query<{ p: string }>(`SELECT provider_message_id AS p FROM messages WHERE provider_message_id LIKE '${HTTP_MATCHED_PREFIX}%' AND sent_at > now() - interval '96 hours'`))
      .map((r) => r.p.slice(HTTP_MATCHED_PREFIX.length)),
  );

  let matched = 0;
  let finalized = 0;
  for (const m of pending) {
    let u: TextifyMessage | undefined;
    if (m.provider_message_id.startsWith(HTTP_MATCHED_PREFIX)) {
      const upId = m.provider_message_id.slice(HTTP_MATCHED_PREFIX.length);
      u = byId.get(upId) ?? (await api.getMessage(upId).catch(() => undefined));
    } else {
      const sentAt = new Date(m.sent_at).getTime();
      const to = digits(m.to_phone);
      u = upstream
        .filter((x) => !claimed.has(String(x.message_id)) && digits(x.phone_number) === to && x.content === m.body
          && Math.abs(new Date(x.created_at).getTime() - sentAt) < MATCH_WINDOW_MS)
        .sort((a, b) => Math.abs(new Date(a.created_at).getTime() - sentAt) - Math.abs(new Date(b.created_at).getTime() - sentAt))[0];
      if (u) {
        claimed.add(String(u.message_id));
        matched++;
        const newId = `${HTTP_MATCHED_PREFIX}${u.message_id}`;
        await queryOne('UPDATE messages SET provider_message_id = $2 WHERE id = $1', [m.id, newId]);
        await queryOne(
          `INSERT INTO message_parts (provider_message_id, message_id, part_no) VALUES ($1, $2, 1) ON CONFLICT (provider_message_id) DO NOTHING`,
          [newId, m.id],
        );
      }
    }
    if (!u) continue;
    if (FINAL_OK.has(u.status)) { await finalizeMessage(m.id, 'delivered'); finalized++; }
    else if (FINAL_BAD.has(u.status)) {
      await finalizeMessage(m.id, 'failed', `textify:${(u.failure_reason || u.status).slice(0, 60)}`);
      finalized++;
    }
  }
  if (matched || finalized) log.info({ checked: pending.length, matched, finalized }, 'textify http reconcile');
  return { checked: pending.length, matched, finalized };
}
