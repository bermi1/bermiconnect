import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { CheckCircle2, Clock } from 'lucide-react';
import { Composer, PhonePreview, SenderSelect } from '../components/Composer';
import { Button, Field, Input, PageHeader, Textarea, cx } from '../components/ui';
import { useToast } from '../components/Toast';
import { api, errMsg } from '../lib/api';
import { useSenderIds } from '../lib/hooks';
import { analyse, splitPhones, PRICE_TZS } from '../lib/sms';
import { tzs } from '../lib/format';

interface SendResult { batch_id: string; messages: { id: string; to: string; status: string; segments: number; cost_tzs: number }[]; total_cost_tzs: number | string }

export default function QuickSend() {
  const [to, setTo] = useState('');
  const [body, setBody] = useState('');
  const [sender, setSender] = useState('BERMI');
  const [later, setLater] = useState(false);
  const [when, setWhen] = useState('');
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [done, setDone] = useState<SendResult | null>(null);
  const toast = useToast();
  const qc = useQueryClient();
  const senders = useSenderIds();
  const approved = (senders.data || []).filter((s) => s.status === 'approved').map((s) => s.name);
  const phones = splitPhones(to);

  const send = useMutation({
    mutationFn: () => api.post<SendResult>('/sms/send', {
      to: phones.valid.length === 1 ? phones.valid[0] : phones.valid,
      message: body, sender_id: sender,
      ...(later && when ? { schedule_at: new Date(when).toISOString() } : {}),
    }),
    onSuccess: (r) => {
      setDone(r);
      toast.success(later ? 'Message scheduled.' : `Sent to ${phones.valid.length} ${phones.valid.length === 1 ? 'number' : 'numbers'}.`);
      qc.invalidateQueries({ queryKey: ['balance'] }); qc.invalidateQueries({ queryKey: ['stats'] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const submit = () => {
    const er: Record<string, string> = {};
    if (!phones.valid.length) er.to = 'Add at least one phone number.';
    else if (phones.invalid.length) er.to = `Check these numbers: ${phones.invalid.slice(0, 3).join(', ')}`;
    else if (phones.valid.length > 1000) er.to = 'Quick send allows up to 1,000 numbers. Use a campaign for more.';
    if (!body.trim()) er.body = 'Write a message.';
    if (later && (!when || new Date(when) < new Date())) er.when = 'Pick a time in the future.';
    setErrs(er);
    if (!Object.keys(er).length) send.mutate();
  };

  if (done) {
    return (
      <div className="max-w-lg mx-auto text-center py-10 animate-rise">
        <div className="mx-auto h-16 w-16 rounded-full bg-ok/10 text-ok grid place-items-center">{later ? <Clock className="h-8 w-8" /> : <CheckCircle2 className="h-8 w-8" />}</div>
        <h1 className="mt-5 text-[28px] font-extrabold tracking-tight">{later ? 'Scheduled' : 'Imetumwa! Sent.'}</h1>
        <p className="mt-2 text-ink-500">{done.messages?.length ?? phones.valid.length} messages · {tzs(done.total_cost_tzs)} charged. Delivery updates appear in the message log.</p>
        <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
          <Button size="lg" onClick={() => { setDone(null); setTo(''); setBody(''); }}>Send another</Button>
          <Link to="/app/messages" className="btn btn-lg btn-outline">Open message log</Link>
        </div>
      </div>
    );
  }

  const segs = analyse(body).segments;
  return (
    <div className="animate-rise">
      <PageHeader title="Quick send" subtitle="Send an SMS to one or a few numbers right now." />
      <div className="grid lg:grid-cols-[1fr_320px] gap-8">
        <div className="panel p-5 sm:p-6 space-y-6">
          <Field label="To" error={errs.to} hint={phones.valid.length ? `${phones.valid.length} valid ${phones.valid.length === 1 ? 'number' : 'numbers'}${phones.invalid.length ? ` · ${phones.invalid.length} not recognised` : ''}` : 'One number per line, or separate with commas. 0754…, 0654… or +255… all work.'}>
            <Textarea rows={3} value={to} onChange={(e) => setTo(e.target.value)} invalid={!!errs.to} placeholder={'0754 123 456\n0713 000 111'} inputMode="tel" />
          </Field>
          <Field label="From (sender name)" hint={<>Want your own name? <Link to="/app/sender-ids" className="text-brand font-semibold">Request a sender name</Link></>}>
            <SenderSelect value={sender} onChange={setSender} approved={approved} />
          </Field>
          <div>
            <span className="field-label">Message</span>
            <Composer value={body} onChange={setBody} recipients={phones.valid.length || 1} error={errs.body} />
            <p className="hint">Personal tags like first name only fill in for saved contacts.</p>
          </div>
          <div>
            <span className="field-label">When</span>
            <div className="grid grid-cols-2 gap-2">
              {[{ v: false, l: 'Send now' }, { v: true, l: 'Later' }].map((o) => (
                <button type="button" key={o.l} onClick={() => setLater(o.v)} aria-pressed={later === o.v}
                  className={cx('h-12 rounded-xl border-2 font-semibold', later === o.v ? 'border-brand bg-brand-50 text-brand-800' : 'border-line bg-white')}>{o.l}</button>
              ))}
            </div>
            {later && <div className="mt-3"><Field error={errs.when}><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} invalid={!!errs.when} /></Field></div>}
          </div>
          <Button size="lg" className="w-full" onClick={submit} loading={send.isPending}>
            {later ? 'Schedule SMS' : `Tuma · ${tzs(segs * PRICE_TZS * Math.max(phones.valid.length, 1))}`}
          </Button>
        </div>
        <div className="hidden lg:block sticky top-10 self-start">
          <PhonePreview body={body} sender={sender} />
        </div>
      </div>
    </div>
  );
}
