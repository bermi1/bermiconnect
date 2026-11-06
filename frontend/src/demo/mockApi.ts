// Demo mode: an in-browser stand-in for the Bermi Connect API.
// Seeded from a snapshot of a real run against the backend (demo school data).
// Changes live in memory for the session only. Enabled only when VITE_DEMO=1.
import snapshot from './snapshot.json';
import { analyse, normalisePhone, PRICE_TZS } from '../lib/sms';

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>;
const db: Record<string, any> = JSON.parse(JSON.stringify(snapshot));
const msgsByCampaign: Record<string, Row[]> = db.campaign_messages;
const detail: Record<string, Row> = db.campaign_detail;
const now = () => new Date().toISOString();
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now());
const account = () => db['/me'].account as Row;

function err(status: number, code: string, message: string) {
  return { status, body: { error: { code, message } } };
}
function ok(data: unknown, status = 200, meta?: unknown) {
  return { status, body: meta ? { data, meta } : { data } };
}
function paged(rows: Row[], q: URLSearchParams) {
  const page = Math.max(1, Number(q.get('page') || 1));
  const per = Math.min(200, Number(q.get('per_page') || 50));
  return ok(rows.slice((page - 1) * per, page * per), 200, { page, per_page: per, total: rows.length });
}
function render(body: string, c: Row) {
  return body.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(c[k] ?? c.fields?.[k] ?? ''));
}
function charge(amount: number, description: string, type = 'charge') {
  const a = account();
  a.balance_tzs = Number(a.balance_tzs) + (type === 'charge' ? -amount : amount);
  db['/transactions'].unshift({ id: uid(), type, status: 'completed', amount_tzs: type === 'charge' ? -amount : amount, balance_after: a.balance_tzs, description, reference: null, method: null, created_at: now() });
  db['/balance'].balance_tzs = a.balance_tzs;
  db['/account/stats'].balance_tzs = a.balance_tzs;
}
function senderOk(name: string) {
  return name === 'BERMI' || db['/sender-ids'].some((s: Row) => s.name === name && s.status === 'approved');
}
function recordDaily(sent: number, delivered: number, failed: number) {
  const st = db['/account/stats'];
  const today = now().slice(0, 10);
  let d = st.daily.find((x: Row) => x.date === today);
  if (!d) { d = { date: today, sent: 0, delivered: 0, failed: 0 }; st.daily.push(d); }
  d.sent += sent; d.delivered += delivered; d.failed += failed;
  st.sent_today += sent; st.sent_30d += sent;
}
// Simulate delivery receipts: ~92% delivered after a short delay.
function deliverLater(rows: Row[], onDone?: () => void) {
  setTimeout(() => {
    let dl = 0; let fl = 0;
    rows.forEach((m, i) => {
      const fail = i % 12 === 11;
      m.status = fail ? 'failed' : 'delivered';
      m.delivered_at = fail ? null : now();
      m.error_code = fail ? 'UNDELIV' : null;
      if (fail) { fl++; charge(Number(m.cost_tzs), `Refund: message to ${m.to_phone} failed`, 'refund'); } else dl++;
    });
    recordDaily(0, dl, fl);
    onDone?.();
  }, 2500);
}
function makeMessages(list: { to: string; body: string; contact?: Row }[], sender: string, campaign_id: string | null) {
  return list.map(({ to, body }) => {
    const a = analyse(body);
    return { id: uid(), campaign_id, batch_id: uid(), to, to_phone: to, sender_id: sender, body, segments: a.segments, encoding: a.encoding, status: 'sent', provider_message_id: uid().slice(0, 16), error_code: null, cost_tzs: a.segments * PRICE_TZS, reference: null, created_at: now(), sent_at: now(), delivered_at: null };
  });
}
function groupMembers(ids: string[]) {
  const seen = new Set<string>();
  return db['/contacts'].filter((c: Row) => !c.opted_out && (c.group_ids || []).some((g: string) => ids.includes(g)) && !seen.has(c.phone) && seen.add(c.phone));
}
function refreshGroupCounts() {
  db['/groups'].forEach((g: Row) => { g.contact_count = db['/contacts'].filter((c: Row) => (c.group_ids || []).includes(g.id)).length; });
  db['/account/stats'].contacts_total = db['/contacts'].length;
}
function launch(c: Row) {
  const members = groupMembers(c.group_ids || []);
  const msgs = makeMessages(members.map((m: Row) => ({ to: m.phone, body: render(c.body, m) })), c.sender_id, c.id);
  const cost = msgs.reduce((s, m) => s + m.cost_tzs, 0);
  if (cost > Number(account().balance_tzs)) return err(402, 'insufficient_balance', 'Not enough balance for this campaign.');
  charge(cost, `Campaign: ${c.name}`);
  Object.assign(c, { status: 'sending', total_recipients: msgs.length, sent_count: msgs.length, delivered_count: 0, failed_count: 0, cost_tzs: cost, started_at: now() });
  msgsByCampaign[c.id] = msgs;
  db['/sms'].unshift(...msgs);
  recordDaily(msgs.length, 0, 0);
  deliverLater(msgs, () => {
    const dl = msgs.filter((m) => m.status === 'delivered').length;
    Object.assign(c, { status: 'completed', delivered_count: dl, failed_count: msgs.length - dl, cost_tzs: cost - (msgs.length - dl) * PRICE_TZS, completed_at: now() });
  });
  return ok(c, 202);
}
function crud(list: Row[], method: string, id: string | undefined, body: Row, q: URLSearchParams, make: (b: Row) => Row) {
  if (!id && method === 'GET') return paged(list, q);
  if (!id && method === 'POST') { const r = make(body); list.unshift(r); return ok(r, 201); }
  const r = list.find((x) => x.id === id);
  if (!r) return err(404, 'not_found', 'Not found.');
  if (method === 'GET') return ok(r);
  if (method === 'PATCH' || method === 'PUT') { Object.assign(r, body); return ok(r); }
  if (method === 'DELETE') { list.splice(list.indexOf(r), 1); return { status: 204, body: null }; }
  return err(405, 'method_not_allowed', 'Not supported in the demo.');
}

function route(method: string, path: string, q: URLSearchParams, body: Row): { status: number; body: unknown } {
  const p = path.split('/').filter(Boolean);
  const [r0, r1, r2, r3] = p;

  if (r0 === 'auth') return ok({ token: 'demo', user: db['/me'].user, account: account() });
  if (r0 === 'me') { if (method === 'PATCH') Object.assign(db['/me'].user, { name: body.name ?? db['/me'].user.name }); return ok(db['/me']); }
  if (r0 === 'account' && r1 === 'stats') return ok(db['/account/stats']);
  if (r0 === 'balance') return ok(db['/balance']);

  if (r0 === 'sms' && r1 === 'send' && method === 'POST') {
    const raw: string[] = Array.isArray(body.to) ? body.to : String(body.to || '').split(/[,\s]+/).filter(Boolean);
    const phones = [...new Set(raw.map((x) => normalisePhone(x)))];
    if (!phones.length || phones.includes(null)) return err(400, 'validation_error', 'One or more phone numbers are invalid.');
    const sender = body.sender_id || 'BERMI';
    if (!senderOk(sender)) return err(422, 'sender_not_approved', 'That sender name is not approved yet.');
    const msgs = makeMessages(phones.map((to) => ({ to: to as string, body: String(body.message || '') })), sender, null);
    const total = msgs.reduce((s, m) => s + m.cost_tzs, 0);
    if (total > Number(account().balance_tzs)) return err(402, 'insufficient_balance', 'Not enough balance. Top up your wallet.');
    charge(total, `SMS to ${msgs.length} number${msgs.length > 1 ? 's' : ''}`);
    db['/sms'].unshift(...msgs);
    recordDaily(msgs.length, 0, 0);
    deliverLater(msgs);
    return ok({ batch_id: msgs[0].batch_id, messages: msgs.map((m) => ({ id: m.id, to: m.to, status: 'queued', segments: m.segments, cost_tzs: m.cost_tzs })), total_cost_tzs: total }, 202);
  }
  if (r0 === 'sms') {
    let rows: Row[] = db['/sms'];
    const st = q.get('status'); const qq = q.get('q');
    if (st) rows = rows.filter((m) => m.status === st);
    if (qq) rows = rows.filter((m) => m.to_phone.includes(qq) || m.body.toLowerCase().includes(qq.toLowerCase()));
    if (r1) { const m = db['/sms'].find((x: Row) => x.id === r1); return m ? ok(m) : err(404, 'not_found', 'Message not found.'); }
    return paged(rows, q);
  }

  if (r0 === 'campaigns') {
    const list: Row[] = db['/campaigns'];
    if (r1 === 'estimate') {
      const members = groupMembers(body.group_ids || []);
      const segs = members.reduce((s: number, m: Row) => s + analyse(render(String(body.body || ''), m)).segments, 0);
      const a = analyse(String(body.body || ''));
      return ok({ recipients: members.length, segments: segs, cost_tzs: segs * PRICE_TZS, segments_per_message: a.segments, encoding: a.encoding });
    }
    if (r1 && r2 === 'messages') {
      let rows = msgsByCampaign[r1] || [];
      if (q.get('status')) rows = rows.filter((m) => m.status === q.get('status'));
      return paged(rows, q);
    }
    if (r1 && r2) {
      const c = list.find((x) => x.id === r1);
      if (!c) return err(404, 'not_found', 'Campaign not found.');
      if (r2 === 'cancel') { c.status = 'cancelled'; return ok(c); }
      if (r2 === 'send') {
        if (body.scheduled_at) { Object.assign(c, { status: 'scheduled', scheduled_at: body.scheduled_at, total_recipients: groupMembers(c.group_ids).length }); return ok(c, 202); }
        return launch(c);
      }
    }
    if (r1 && method === 'GET') { const c = list.find((x) => x.id === r1); return c ? ok({ ...detail[r1], ...c }) : err(404, 'not_found', 'Campaign not found.'); }
    if (!r1 && method === 'GET' && q.get('status')) return paged(list.filter((c) => c.status === q.get('status')), q);
    return crud(list, method, r1, body, q, (b) => ({ id: uid(), status: 'draft', total_recipients: groupMembers(b.group_ids || []).length, sent_count: 0, delivered_count: 0, failed_count: 0, cost_tzs: 0, created_at: now(), scheduled_at: null, ...b }));
  }

  if (r0 === 'contacts') {
    const list: Row[] = db['/contacts'];
    if (r1 === 'import') return err(400, 'demo_only', 'CSV import needs the real backend. Try adding a contact by hand instead.');
    if (!r1 && method === 'GET') {
      let rows = list; const qq = (q.get('q') || '').toLowerCase(); const g = q.get('group_id');
      if (qq) rows = rows.filter((c) => `${c.first_name} ${c.last_name} ${c.phone}`.toLowerCase().includes(qq));
      if (g) rows = rows.filter((c) => (c.group_ids || []).includes(g));
      return paged(rows, q);
    }
    if (!r1 && method === 'POST') {
      const phone = normalisePhone(String(body.phone || ''));
      if (!phone) return err(400, 'validation_error', 'Enter a valid Tanzanian phone number.');
      if (list.some((c) => c.phone === phone)) return err(409, 'conflict', 'A contact with this number already exists.');
    }
    const res = crud(list, method, r1, { ...body, ...(body.phone ? { phone: normalisePhone(body.phone) } : {}) }, q, (b) => ({ id: uid(), fields: {}, opted_out: false, group_ids: [], created_at: now(), ...b }));
    refreshGroupCounts();
    return res;
  }

  if (r0 === 'groups') {
    const list: Row[] = db['/groups'];
    if (r1 && r2 === 'contacts') {
      if (method === 'POST') (body.contact_ids || []).forEach((cid: string) => { const c = db['/contacts'].find((x: Row) => x.id === cid); if (c && !c.group_ids.includes(r1)) c.group_ids.push(r1); });
      if (method === 'DELETE' && r3) { const c = db['/contacts'].find((x: Row) => x.id === r3); if (c) c.group_ids = c.group_ids.filter((g: string) => g !== r1); }
      refreshGroupCounts();
      return ok({ ok: true });
    }
    return crud(list, method, r1, body, q, (b) => ({ id: uid(), contact_count: 0, created_at: now(), ...b }));
  }

  if (r0 === 'templates') return crud(db['/templates'], method, r1, body, q, (b) => ({ id: uid(), created_at: now(), ...b }));
  if (r0 === 'sender-ids') return crud(db['/sender-ids'], method, r1, body, q, (b) => ({ id: uid(), status: 'pending', created_at: now(), ...b, name: String(b.name || '').toUpperCase() }));

  if (r0 === 'api-keys') {
    const list: Row[] = db['/api-keys'];
    if (method === 'POST') {
      const mode = body.mode === 'test' ? 'test' : 'live';
      const key = `bc_${mode}_${'demo'}${uid().replace(/-/g, '').slice(0, 28)}`;
      const r = { id: uid(), name: body.name || 'New key', prefix: key.slice(0, 12), mode, last_used_at: null, revoked_at: null, created_at: now() };
      list.unshift(r);
      return ok({ ...r, key }, 201);
    }
    if (method === 'DELETE') { const r = list.find((x) => x.id === r1); if (r) r.revoked_at = now(); return { status: 204, body: null }; }
    return paged(list, q);
  }

  if (r0 === 'webhooks') {
    if (r2 === 'test') return ok({ ok: true, status: 200, duration_ms: 142, response_body: 'OK (demo)' });
    if (method === 'POST') { const r = { id: uid(), active: true, created_at: now(), events: [], ...body, secret: 'whsec_demo' + uid().replace(/-/g, '').slice(0, 24) }; db['/webhooks'].unshift(r); return ok(r, 201); }
    return crud(db['/webhooks'], method, r1, body, q, (b) => b);
  }

  if (r0 === 'transactions') return paged(db['/transactions'], q);
  if (r0 === 'wallet' && r1 === 'topup') {
    const amt = Number(body.amount_tzs || 0);
    if (amt < 1000) return err(400, 'validation_error', 'The minimum top-up is TZS 1,000.');
    charge(amt, `Top-up via ${body.method || 'manual'} (demo)`, 'topup');
    return ok({ status: 'completed', transaction: db['/transactions'][0], balance_tzs: account().balance_tzs, sandbox: true }, 201);
  }
  return err(404, 'not_found', `The demo doesn't cover ${method} /${path}.`);
}

export function installDemoApi(apiUrl: string) {
  const real = window.fetch.bind(window);
  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    if (!url.startsWith(apiUrl)) return real(input, init);
    const u = new URL(url);
    const path = u.pathname.replace(new URL(apiUrl).pathname, '');
    let body: Row = {};
    if (typeof init?.body === 'string') { try { body = JSON.parse(init.body); } catch { body = {}; } }
    await new Promise((r) => setTimeout(r, 180 + Math.random() * 220));
    const res = route((init?.method || 'GET').toUpperCase(), path, u.searchParams, body);
    return new Response(res.body === null ? null : JSON.stringify(res.body), { status: res.status, headers: { 'Content-Type': 'application/json' } });
  };
}
