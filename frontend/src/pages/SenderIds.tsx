import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { BadgeCheck, Plus, Trash2 } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useSenderIds } from '../lib/hooks';
import type { SenderId } from '../lib/types';
import { Button, ErrorBox, Field, Input, Modal, PageHeader, StatusBadge, TableSkeleton, Textarea } from '../components/ui';
import { useToast } from '../components/Toast';
import { dateOnly } from '../lib/format';

export default function SenderIds() {
  const s = useSenderIds();
  const [open, setOpen] = useState(false);
  const [del, setDel] = useState<SenderId | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const remove = useMutation({
    mutationFn: (id: string) => api.del(`/sender-ids/${id}`),
    onSuccess: () => { toast.success('Sender name removed.'); setDel(null); qc.invalidateQueries({ queryKey: ['sender-ids'] }); },
    onError: (e) => toast.error(errMsg(e)),
  });

  return (
    <div className="animate-rise">
      <PageHeader title="Sender names" subtitle="The name people see instead of a phone number, like MLIMANISEC."
        actions={<Button icon={<Plus className="h-4 w-4" />} onClick={() => setOpen(true)}>Request a name</Button>} />
      <div className="panel overflow-hidden">
        {s.isLoading ? <TableSkeleton rows={3} /> : s.isError ? <ErrorBox error={s.error} onRetry={() => s.refetch()} /> : (
          <ul className="divide-y divide-line">
            <li className="flex items-center gap-4 px-5 py-4">
              <div className="h-10 w-10 rounded-xl bg-brand text-white grid place-items-center font-bold">B</div>
              <div className="flex-1 min-w-0"><div className="font-bold font-mono tracking-wide">BERMI</div><div className="text-[13px] text-ink-500">Default — always available</div></div>
              <StatusBadge status="approved" label="Ready to use" />
            </li>
            {(s.data || []).map((x) => (
              <li key={x.id} className="flex items-center gap-4 px-5 py-4">
                <div className="h-10 w-10 rounded-xl bg-brand-50 text-brand-700 grid place-items-center font-bold">{x.name[0]}</div>
                <div className="flex-1 min-w-0"><div className="font-bold font-mono tracking-wide">{x.name}</div><div className="text-[13px] text-ink-500 truncate">{x.purpose || 'No purpose given'} · requested {dateOnly(x.created_at)}</div></div>
                <StatusBadge status={x.status} />
                <button onClick={() => setDel(x)} className="h-9 w-9 grid place-items-center rounded-lg hover:bg-bad/10 text-ink-400 hover:text-bad" aria-label="Remove"><Trash2 className="h-4 w-4" /></button>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div className="mt-6 rounded-2xl bg-amber-50 border border-amber/30 p-5 text-[15px] text-ink-700 flex gap-3">
        <BadgeCheck className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
        <p>New names are checked by our team and the mobile networks, usually within 1–2 working days. Until then, your messages go out as <b>BERMI</b>.</p>
      </div>
      {open && <RequestModal onClose={() => setOpen(false)} />}
      <Modal open={!!del} onClose={() => setDel(null)} title="Remove sender name?"
        footer={<><Button variant="ghost" onClick={() => setDel(null)}>Keep</Button><Button variant="danger" loading={remove.isPending} onClick={() => del && remove.mutate(del.id)}>Remove</Button></>}>
        <p className="text-ink-500">You won’t be able to send as {del?.name} anymore.</p>
      </Modal>
    </div>
  );
}

function RequestModal({ onClose }: { onClose: () => void }) {
  const [name, setName] = useState('');
  const [purpose, setPurpose] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const valid = /^[A-Za-z0-9 ]{3,11}$/.test(name) && /[A-Za-z]/.test(name);
  const save = useMutation({
    mutationFn: () => {
      if (!valid) throw new Error('Use 3–11 letters or numbers, with at least one letter.');
      if (!purpose.trim()) throw new Error('Tell us what you will send with this name.');
      return api.post('/sender-ids', { name: name.trim().toUpperCase(), purpose });
    },
    onSuccess: () => { toast.success('Request sent. We’ll review it soon.'); qc.invalidateQueries({ queryKey: ['sender-ids'] }); onClose(); },
    onError: (e) => setErr(errMsg(e)),
  });
  return (
    <Modal open onClose={onClose} title="Request a sender name"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button loading={save.isPending} onClick={() => save.mutate()}>Send request</Button></>}>
      <div className="space-y-4">
        <Field label="Name" hint={`${name.length}/11 · letters and numbers only`}><Input value={name} maxLength={11} onChange={(e) => setName(e.target.value.toUpperCase())} placeholder="MLIMANISEC" className="font-mono tracking-wider" /></Field>
        <Field label="What will you send?"><Textarea rows={3} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="Fee reminders and announcements to parents of Mlimani Secondary School" /></Field>
        {err && <p className="err">{err}</p>}
      </div>
    </Modal>
  );
}
