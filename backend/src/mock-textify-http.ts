/**
 * Local stand-in for the documented Textify HTTP API (https://textify.africa/docs/), for tests only.
 * Base: http://localhost:4010/api/v1   (MOCK_TEXTIFY_PORT)
 *
 *  POST /messages {sender_name, messages:[{receiver, content}], is_scheduled, scheduled_date} -> 201 data:null
 *  GET  /messages?status=&page=&limit=    GET /messages/search?search=    GET /messages/:id
 *  POST /sender-names {name, reason, is_default}   GET /sender-names?status=   GET/PUT/DELETE /sender-names/:id
 *  POST /otps {phone_number}   POST /otps/verify {code, phone_number}
 *
 * Behaviour: messages go sending -> sent -> delivered after MOCK_TEXTIFY_DLR_MS; receivers ending 0000 end
 * "undelivered". Non-ASCII is removed and count = ceil(len/160). Unapproved sender -> 400 creation_error.
 * New sender names are "requested" and become "approved" after MOCK_TEXTIFY_APPROVE_MS, or "declined" if
 * the name contains "DECLINE". Any non-empty Bearer token is accepted.
 */
import crypto from 'node:crypto';
import http from 'node:http';

const PORT = Number(process.env.MOCK_TEXTIFY_PORT ?? 4010);
const DLR_MS = Number(process.env.MOCK_TEXTIFY_DLR_MS ?? 3000);
const APPROVE_MS = Number(process.env.MOCK_TEXTIFY_APPROVE_MS ?? 5000);
const log = (...a: unknown[]) => console.log(`[mock-textify ${new Date().toISOString().slice(11, 19)}]`, ...a);

interface Msg { message_id: string; status: string; content: string; count: number; sender_name: string; phone_number: string; failure_reason: string | null; created_at: string }
interface Sender { id: string; name: string; reason: string; status: 'requested' | 'approved' | 'declined'; is_default: boolean; created_at: string }

const messages: Msg[] = [];
const senders: Sender[] = ['BERMI', 'DEMOSCHOOL'].map((name) => ({ id: crypto.randomUUID(), name, reason: 'seed', status: 'approved', is_default: name === 'BERMI', created_at: new Date().toISOString() }));
const otps = new Map<string, { code: number; exp: number }>();

const env = (res: http.ServerResponse, code: number, data: unknown, message = 'OK', error: unknown = null) => {
  res.writeHead(code, { 'content-type': 'application/json' }).end(
    JSON.stringify({ success: code < 400, status_code: code, status_text: http.STATUS_CODES[code], message, data, error }),
  );
};
const page = <T>(rows: T[], q: URLSearchParams) => {
  const limit = Math.min(1000, Math.max(1, Number(q.get('limit') ?? 20)));
  const p = Math.max(1, Number(q.get('page') ?? 1));
  return { data: rows.slice((p - 1) * limit, p * limit), total: rows.length, page: p, limit, total_pages: Math.max(1, Math.ceil(rows.length / limit)) };
};
const ascii = (s: string) => s.replace(/[^\n\x20-\x7E]/g, '');

http.createServer((req, res) => {
  let raw = '';
  req.on('data', (c) => (raw += c));
  req.on('end', () => {
    const u = new URL(req.url ?? '/', 'http://x');
    const path = u.pathname.replace(/^\/api\/v1/, '');
    const q = u.searchParams;
    if (u.pathname === '/__state') return env(res, 200, { messages: messages.length, senders });
    if (!/^Bearer \S+/.test(req.headers.authorization ?? '')) return env(res, 401, null, 'Unauthenticated', { code: 'unauthorized' });
    let b: any = {};
    try { b = raw ? JSON.parse(raw) : {}; } catch { return env(res, 400, null, 'Invalid JSON', { code: 'validation_error' }); }
    const m = req.method;
    const seg = path.split('/').filter(Boolean);

    if (seg[0] === 'messages') {
      if (m === 'POST' && seg.length === 1) {
        if (!b.sender_name || !Array.isArray(b.messages) || !b.messages.length) return env(res, 400, null, 'sender_name and messages are required', { code: 'validation_error' });
        const s = senders.find((x) => x.name.toUpperCase() === String(b.sender_name).toUpperCase());
        if (!s || s.status !== 'approved') return env(res, 400, null, `Sender name ${b.sender_name} is not approved`, { code: 'creation_error' });
        for (const x of b.messages) {
          const content = ascii(String(x.content ?? ''));
          const msg: Msg = { message_id: crypto.randomUUID(), status: 'sending', content, count: Math.max(1, Math.ceil(content.length / 160)), sender_name: s.name, phone_number: String(x.receiver), failure_reason: null, created_at: new Date().toISOString() };
          messages.unshift(msg);
          setTimeout(() => (msg.status = 'sent'), DLR_MS / 3);
          setTimeout(() => {
            const fail = msg.phone_number.endsWith('0000');
            msg.status = fail ? 'undelivered' : 'delivered';
            msg.failure_reason = fail ? 'Subscriber absent' : null;
          }, DLR_MS);
          log(`POST /messages ${s.name} -> ${msg.phone_number} (${msg.count}): ${content.slice(0, 50)}`);
        }
        return env(res, 201, null, 'Messages created');
      }
      if (m === 'GET' && seg[1] === 'search') {
        const t = (q.get('search') ?? '').toLowerCase();
        return env(res, 200, page(messages.filter((x) => x.phone_number.includes(t) || x.content.toLowerCase().includes(t)), q));
      }
      if (m === 'GET' && seg[1]) {
        const x = messages.find((y) => y.message_id === seg[1]);
        return x ? env(res, 200, x) : env(res, 404, null, 'Not found', { code: 'not_found' });
      }
      if (m === 'GET') return env(res, 200, page(messages.filter((x) => !q.get('status') || x.status === q.get('status')), q));
    }

    if (seg[0] === 'sender-names') {
      if (m === 'POST' && seg.length === 1) {
        const name = String(b.name ?? '').trim();
        if (!name || name.length > 11 || !b.reason) return env(res, 400, null, 'name (max 11) and reason are required', { code: 'validation_error' });
        if (senders.some((x) => x.name.toUpperCase() === name.toUpperCase())) return env(res, 400, null, 'Sender name already exists', { code: 'creation_error' });
        const s: Sender = { id: crypto.randomUUID(), name, reason: String(b.reason), status: 'requested', is_default: !!b.is_default, created_at: new Date().toISOString() };
        senders.push(s);
        setTimeout(() => (s.status = /DECLINE/i.test(name) ? 'declined' : 'approved'), APPROVE_MS);
        log(`sender name requested: ${name}`);
        return env(res, 201, s, 'Sender name requested');
      }
      const s = seg[1] ? senders.find((x) => x.id === seg[1]) : null;
      if (seg[1] && !s) return env(res, 404, null, 'Not found', { code: 'not_found' });
      if (m === 'GET' && s) return env(res, 200, s);
      if (m === 'PUT' && s) { Object.assign(s, { reason: b.reason ?? s.reason, is_default: b.is_default ?? s.is_default }); return env(res, 200, s); }
      if (m === 'DELETE' && s) { senders.splice(senders.indexOf(s), 1); return env(res, 200, null, 'Deleted'); }
      if (m === 'GET') return env(res, 200, page(senders.filter((x) => !q.get('status') || x.status === q.get('status')), q));
    }

    if (seg[0] === 'otps') {
      if (seg[1] === 'verify') {
        const o = otps.get(String(b.phone_number));
        return env(res, 200, { verified: !!o && o.exp > Date.now() && o.code === Number(b.code) });
      }
      const code = crypto.randomInt(100000, 999999);
      otps.set(String(b.phone_number), { code, exp: Date.now() + 30 * 60_000 });
      return env(res, 201, null, 'OTP sent');
    }
    env(res, 404, null, `No route ${m} ${path}`, { code: 'not_found' });
  });
}).listen(PORT, () => log(`listening on http://localhost:${PORT}/api/v1`));
