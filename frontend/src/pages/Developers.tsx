import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { KeyRound, Plus, Copy, Check, Webhook as WebhookIcon, Trash2, Zap, BookOpen, AlertTriangle, Pencil } from 'lucide-react';
import { api, API_URL, DOCS_URL, errMsg } from '../lib/api';
import type { ApiKey, Webhook, WebhookEvent } from '../lib/types';
import { Button, Empty, ErrorBox, Field, Input, Modal, PageHeader, StatusBadge, TableSkeleton, Toggle, cx } from '../components/ui';
import { useToast } from '../components/Toast';
import { ago, dateOnly } from '../lib/format';

function useCopy() {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = async (text: string, id = 'x') => {
    try { await navigator.clipboard.writeText(text); } catch {
      const t = document.createElement('textarea'); t.value = text; document.body.appendChild(t); t.select(); document.execCommand('copy'); t.remove();
    }
    setCopied(id); setTimeout(() => setCopied(null), 1600);
  };
  return { copied, copy };
}

export default function Developers() {
  return (
    <div className="animate-rise">
      <PageHeader title="Developers" subtitle="Send SMS and OTPs from your own app or website."
        actions={<a href={DOCS_URL} target="_blank" rel="noreferrer" className="btn btn-md btn-outline"><BookOpen className="h-4 w-4" />API docs</a>} />
      <div className="space-y-6">
        <QuickStart />
        <Keys />
        <Webhooks />
      </div>
    </div>
  );
}

const LANGS = ['cURL', 'JavaScript', 'Python', 'PHP'] as const;
function snippet(lang: (typeof LANGS)[number]) {
  const url = `${API_URL}/sms/send`;
  switch (lang) {
    case 'cURL': return `curl -X POST ${url} \\
  -H "Authorization: Bearer $BERMI_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"to": "0754123456", "message": "Habari! Your order is ready.", "sender_id": "BERMI"}'`;
    case 'JavaScript': return `const res = await fetch("${url}", {
  method: "POST",
  headers: {
    Authorization: \`Bearer \${process.env.BERMI_API_KEY}\`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify({ to: "0754123456", message: "Habari! Your order is ready.", sender_id: "BERMI" }),
});
const { data } = await res.json();
console.log(data.batch_id, data.total_cost_tzs);`;
    case 'Python': return `import os, requests

r = requests.post(
    "${url}",
    headers={"Authorization": f"Bearer {os.environ['BERMI_API_KEY']}"},
    json={"to": "0754123456", "message": "Habari! Your order is ready.", "sender_id": "BERMI"},
)
print(r.json()["data"])`;
    case 'PHP': return `<?php
$ch = curl_init("${url}");
curl_setopt_array($ch, [
  CURLOPT_POST => true,
  CURLOPT_RETURNTRANSFER => true,
  CURLOPT_HTTPHEADER => [
    "Authorization: Bearer " . getenv("BERMI_API_KEY"),
    "Content-Type: application/json",
  ],
  CURLOPT_POSTFIELDS => json_encode([
    "to" => "0754123456", "message" => "Habari! Your order is ready.", "sender_id" => "BERMI",
  ]),
]);
$res = json_decode(curl_exec($ch), true);
print_r($res["data"]);`;
  }
}

function QuickStart() {
  const [lang, setLang] = useState<(typeof LANGS)[number]>('cURL');
  const { copied, copy } = useCopy();
  return (
    <section className="rounded-2xl bg-ink text-white overflow-hidden">
      <div className="p-5 sm:p-6 grid md:grid-cols-3 gap-5 border-b border-white/10">
        {['Create an API key below. Use a test key first — it never charges.', 'Send a POST to /sms/send with the number and message.', 'Add a webhook to get delivery reports pushed to you.'].map((t, i) => (
          <div key={i} className="flex gap-3">
            <span className="h-7 w-7 rounded-full bg-amber text-ink font-black text-sm grid place-items-center shrink-0">{i + 1}</span>
            <p className="text-[15px] text-white/80">{t}</p>
          </div>
        ))}
      </div>
      <div className="flex items-center justify-between px-3 sm:px-4 border-b border-white/10">
        <div className="flex overflow-x-auto scrollbar-none">
          {LANGS.map((l) => (
            <button key={l} onClick={() => setLang(l)} className={cx('h-11 px-3 sm:px-4 text-sm font-semibold border-b-2 whitespace-nowrap', lang === l ? 'border-amber text-white' : 'border-transparent text-white/50 hover:text-white')}>{l}</button>
          ))}
        </div>
        <button onClick={() => copy(snippet(lang), 'snip')} className="h-9 px-3 rounded-lg text-sm text-white/70 hover:bg-white/10 inline-flex items-center gap-1.5">
          {copied === 'snip' ? <Check className="h-4 w-4 text-[#5fd3ad]" /> : <Copy className="h-4 w-4" />}{copied === 'snip' ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre className="p-5 text-[13px] leading-relaxed font-mono overflow-x-auto text-[#cfe9df] bg-[#06140F]"><code>{snippet(lang)}</code></pre>
    </section>
  );
}

function Keys() {
  const keys = useQuery({ queryKey: ['api-keys'], queryFn: () => api.get<ApiKey[]>('/api-keys') });
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [mode, setMode] = useState<'live' | 'test'>('test');
  const [fresh, setFresh] = useState<string | null>(null);
  const [revoke, setRevoke] = useState<ApiKey | null>(null);
  const { copied, copy } = useCopy();
  const qc = useQueryClient();
  const toast = useToast();

  const create = useMutation({
    mutationFn: () => api.post<ApiKey & { key: string }>('/api-keys', { name: name.trim() || 'My key', mode }),
    onSuccess: (r) => { setCreating(false); setName(''); setFresh(r.key); qc.invalidateQueries({ queryKey: ['api-keys'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const del = useMutation({
    mutationFn: (id: string) => api.del(`/api-keys/${id}`),
    onSuccess: () => { toast.success('Key revoked.'); setRevoke(null); qc.invalidateQueries({ queryKey: ['api-keys'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const list = keys.data || [];

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
        <div><h2 className="font-bold text-lg">API keys</h2><p className="text-[13px] text-ink-500">Keep keys secret — they can send SMS from your balance.</p></div>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setCreating(true)}>New key</Button>
      </div>
      {keys.isLoading ? <TableSkeleton rows={2} /> : keys.isError ? <ErrorBox error={keys.error} onRetry={() => keys.refetch()} /> : !list.length ? (
        <Empty icon={<KeyRound className="h-6 w-6" />} title="No API keys yet" body="Create a test key to try the API without spending money." action={<Button onClick={() => setCreating(true)}>Create a key</Button>} />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((k) => (
            <li key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-4">
              <div className="flex-1 min-w-[200px]">
                <div className="flex items-center gap-2"><span className="font-semibold">{k.name}</span>
                  <span className={cx('text-[12px] font-bold px-1.5 py-0.5 rounded-md', k.mode === 'live' ? 'bg-brand-50 text-brand-700' : 'bg-amber-100 text-amber-700')}>{k.mode === 'live' ? 'Live' : 'Test'}</span>
                </div>
                <div className="text-[13px] text-ink-500 font-mono mt-0.5">{k.prefix}••••••••</div>
              </div>
              <div className="text-[13px] text-ink-500">Created {dateOnly(k.created_at)} · used {ago(k.last_used_at)}</div>
              {k.revoked_at ? <StatusBadge status="revoked" /> : <Button size="sm" variant="ghost" className="text-bad" onClick={() => setRevoke(k)}>Revoke</Button>}
            </li>
          ))}
        </ul>
      )}

      <Modal open={creating} onClose={() => setCreating(false)} title="Create API key"
        footer={<><Button variant="ghost" onClick={() => setCreating(false)}>Cancel</Button><Button loading={create.isPending} onClick={() => create.mutate()}>Create key</Button></>}>
        <div className="space-y-4">
          <Field label="Name" hint="So you remember where it’s used."><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. School portal" /></Field>
          <div>
            <span className="field-label">Mode</span>
            <div className="grid grid-cols-2 gap-2">
              {([['test', 'Test', 'Simulated, no charge'], ['live', 'Live', 'Real SMS, charged']] as const).map(([v, l, d]) => (
                <button key={v} type="button" onClick={() => setMode(v)} className={cx('text-left rounded-xl border-2 p-3', mode === v ? 'border-brand bg-brand-50' : 'border-line')}>
                  <div className="font-bold">{l}</div><div className="text-[13px] text-ink-500">{d}</div>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Modal>

      <Modal open={!!fresh} onClose={() => setFresh(null)} title="Copy your new key now"
        footer={<Button onClick={() => setFresh(null)}>I’ve saved it</Button>}>
        <div className="flex items-start gap-2 rounded-xl bg-amber-50 border border-amber/40 p-3 text-sm mb-4">
          <AlertTriangle className="h-4 w-4 text-amber-700 mt-0.5 shrink-0" />
          <span>This is the only time the full key is shown. Store it somewhere safe, like your server’s environment variables.</span>
        </div>
        <div className="flex gap-2">
          <code className="flex-1 min-w-0 rounded-xl bg-ink text-[#cfe9df] font-mono text-[13px] p-3 break-all">{fresh}</code>
          <Button variant="outline" onClick={() => fresh && copy(fresh, 'key')} icon={copied === 'key' ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}>{copied === 'key' ? 'Copied' : 'Copy'}</Button>
        </div>
      </Modal>

      <Modal open={!!revoke} onClose={() => setRevoke(null)} title="Revoke this key?"
        footer={<><Button variant="ghost" onClick={() => setRevoke(null)}>Keep key</Button><Button variant="danger" loading={del.isPending} onClick={() => revoke && del.mutate(revoke.id)}>Revoke key</Button></>}>
        <p className="text-ink-500">Apps using “{revoke?.name}” will stop working immediately. This can’t be undone.</p>
      </Modal>
    </section>
  );
}

const EVENTS: { v: WebhookEvent; l: string }[] = [
  { v: 'message.delivered', l: 'Message delivered' }, { v: 'message.failed', l: 'Message failed' },
  { v: 'campaign.completed', l: 'Campaign finished' }, { v: 'message.inbound', l: 'Reply received' },
];

function Webhooks() {
  const hooks = useQuery({ queryKey: ['webhooks'], queryFn: () => api.get<Webhook[]>('/webhooks') });
  const [edit, setEdit] = useState<Webhook | 'new' | null>(null);
  const [del, setDel] = useState<Webhook | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const test = useMutation({
    mutationFn: (id: string) => api.post(`/webhooks/${id}/test`, {}),
    onSuccess: () => toast.success('Test event sent. Check your server logs.'),
    onError: (e) => toast.error(errMsg(e)),
  });
  const toggle = useMutation({
    mutationFn: (w: Webhook) => api.patch(`/webhooks/${w.id}`, { active: !w.active }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['webhooks'] }),
    onError: (e) => toast.error(errMsg(e)),
  });
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/webhooks/${id}`),
    onSuccess: () => { toast.success('Webhook deleted.'); setDel(null); qc.invalidateQueries({ queryKey: ['webhooks'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });
  const list = hooks.data || [];

  return (
    <section className="panel overflow-hidden">
      <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
        <div><h2 className="font-bold text-lg">Webhooks</h2><p className="text-[13px] text-ink-500">We POST events to your URL, signed with <code className="font-mono">X-Bermi-Signature</code>.</p></div>
        <Button size="sm" icon={<Plus className="h-4 w-4" />} onClick={() => setEdit('new')}>Add webhook</Button>
      </div>
      {hooks.isLoading ? <TableSkeleton rows={2} /> : hooks.isError ? <ErrorBox error={hooks.error} onRetry={() => hooks.refetch()} /> : !list.length ? (
        <Empty icon={<WebhookIcon className="h-6 w-6" />} title="No webhooks" body="Get delivery reports and replies sent straight to your server." />
      ) : (
        <ul className="divide-y divide-line">
          {list.map((w) => (
            <li key={w.id} className="px-5 py-4 flex flex-wrap items-center gap-x-4 gap-y-3">
              <div className="flex-1 min-w-[220px]">
                <div className="font-mono text-[14px] break-all">{w.url}</div>
                <div className="mt-1.5 flex flex-wrap gap-1.5">{w.events.map((e) => <span key={e} className="text-[12px] rounded-md bg-paper border border-line px-1.5 py-0.5 font-mono">{e}</span>)}</div>
              </div>
              <Toggle checked={w.active} onChange={() => toggle.mutate(w)} label="Active" />
              <div className="flex gap-1">
                <Button size="sm" variant="outline" icon={<Zap className="h-4 w-4" />} onClick={() => test.mutate(w.id)} loading={test.isPending && test.variables === w.id}>Test</Button>
                <button onClick={() => setEdit(w)} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-ink/5" aria-label="Edit"><Pencil className="h-4 w-4" /></button>
                <button onClick={() => setDel(w)} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-bad/10 text-bad" aria-label="Delete"><Trash2 className="h-4 w-4" /></button>
              </div>
            </li>
          ))}
        </ul>
      )}
      {edit && <WebhookModal hook={edit === 'new' ? null : edit} onClose={() => setEdit(null)} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Delete webhook?"
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Keep</Button><Button variant="danger" loading={remove.isPending} onClick={() => del && remove.mutate(del.id)}>Delete webhook</Button></>}>
        <p className="text-ink-500 break-all">Events will stop going to {del?.url}.</p>
      </Modal>
    </section>
  );
}

function WebhookModal({ hook, onClose }: { hook: Webhook | null; onClose: () => void }) {
  const [url, setUrl] = useState(hook?.url || '');
  const [events, setEvents] = useState<WebhookEvent[]>(hook?.events || ['message.delivered', 'message.failed']);
  const [secret, setSecret] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const { copied, copy } = useCopy();
  const qc = useQueryClient();
  const toast = useToast();
  const save = useMutation({
    mutationFn: () => {
      if (!/^https?:\/\/\S+$/.test(url)) throw new Error('Enter a full URL starting with https://');
      if (!events.length) throw new Error('Choose at least one event.');
      return hook ? api.patch<Webhook>(`/webhooks/${hook.id}`, { url, events }) : api.post<Webhook>('/webhooks', { url, events });
    },
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ['webhooks'] });
      if (!hook && r?.secret) { setSecret(r.secret); return; }
      toast.success('Webhook saved.'); onClose();
    },
    onError: (e) => setErr(errMsg(e)),
  });

  if (secret) {
    return (
      <Modal open onClose={onClose} title="Webhook added" footer={<Button onClick={onClose}>Done</Button>}>
        <p className="text-sm text-ink-500 mb-3">Use this signing secret to verify the <code className="font-mono">X-Bermi-Signature</code> header (HMAC-SHA256 of the body).</p>
        <div className="flex gap-2">
          <code className="flex-1 min-w-0 rounded-xl bg-ink text-[#cfe9df] font-mono text-[13px] p-3 break-all">{secret}</code>
          <Button variant="outline" onClick={() => copy(secret, 's')} icon={copied === 's' ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}>{copied === 's' ? 'Copied' : 'Copy'}</Button>
        </div>
      </Modal>
    );
  }
  return (
    <Modal open onClose={onClose} title={hook ? 'Edit webhook' : 'Add webhook'}
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Save webhook</Button></>}>
      <div className="space-y-4">
        <Field label="Endpoint URL"><Input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://example.co.tz/hooks/bermi" className="font-mono text-sm" /></Field>
        <div>
          <span className="field-label">Events</span>
          <div className="space-y-2">
            {EVENTS.map((e) => {
              const on = events.includes(e.v);
              return (
                <label key={e.v} className={cx('flex items-center gap-3 rounded-xl border-2 p-3 cursor-pointer', on ? 'border-brand bg-brand-50' : 'border-line')}>
                  <input type="checkbox" className="h-5 w-5 accent-[#201F5B]" checked={on} onChange={() => setEvents(on ? events.filter((x) => x !== e.v) : [...events, e.v])} />
                  <span className="flex-1 font-semibold">{e.l}</span>
                  <code className="text-[12px] text-ink-500 font-mono">{e.v}</code>
                </label>
              );
            })}
          </div>
        </div>
        {err && <p className="err">{err}</p>}
      </div>
    </Modal>
  );
}
