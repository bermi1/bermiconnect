import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Check, ChevronLeft, Users, CalendarClock, Zap, AlertTriangle } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { Campaign, Estimate } from '../lib/types';
import { useBalance, useGroups, useSenderIds, groupSize } from '../lib/hooks';
import { Composer, PhonePreview, SenderSelect } from '../components/Composer';
import { Button, Empty, Field, Input, Skeleton, cx } from '../components/ui';
import { useToast } from '../components/Toast';
import { analyse, render } from '../lib/sms';
import { int, tzs } from '../lib/format';

const STEPS = ['Name', 'Audience', 'Message', 'When', 'Review'];

export default function CampaignWizard() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState('');
  const [groupIds, setGroupIds] = useState<string[]>([]);
  const [body, setBody] = useState('');
  const [sender, setSender] = useState('BERMI');
  const [later, setLater] = useState(false);
  const [when, setWhen] = useState('');
  const [err, setErr] = useState<string | null>(null);
  const groups = useGroups();
  const senders = useSenderIds();
  const balance = useBalance();
  const nav = useNavigate();
  const qc = useQueryClient();
  const toast = useToast();
  const approved = (senders.data || []).filter((s) => s.status === 'approved').map((s) => s.name);

  const roughRecipients = useMemo(() => (groups.data || []).filter((g) => groupIds.includes(g.id)).reduce((n, g) => n + (groupSize(g) || 0), 0), [groups.data, groupIds]);

  const estimate = useQuery({
    queryKey: ['estimate', groupIds, body],
    queryFn: () => api.post<Estimate>('/campaigns/estimate', { group_ids: groupIds, body }),
    enabled: step === 4 && groupIds.length > 0 && !!body.trim(),
  });

  useEffect(() => { setErr(null); }, [step]);

  const launch = useMutation({
    mutationFn: async () => {
      const scheduled_at = later && when ? new Date(when).toISOString() : null;
      const c = await api.post<Campaign>('/campaigns', { name: name.trim(), sender_id: sender, body, group_ids: groupIds, scheduled_at });
      await api.post(`/campaigns/${c.id}/send`, scheduled_at ? { scheduled_at } : {});
      return c;
    },
    onSuccess: (c) => {
      toast.success(later ? 'Campaign scheduled.' : 'Campaign is sending.');
      qc.invalidateQueries({ queryKey: ['campaigns'] }); qc.invalidateQueries({ queryKey: ['balance'] }); qc.invalidateQueries({ queryKey: ['stats'] });
      nav(`/app/campaigns/${c.id}`);
    },
    onError: (e) => setErr(errMsg(e)),
  });

  const saveDraft = useMutation({
    mutationFn: () => api.post<Campaign>('/campaigns', { name: name.trim() || 'Untitled campaign', sender_id: sender, body, group_ids: groupIds, scheduled_at: null }),
    onSuccess: (c) => { toast.success('Draft saved.'); qc.invalidateQueries({ queryKey: ['campaigns'] }); nav(`/app/campaigns/${c.id}`); },
    onError: (e) => toast.error(errMsg(e)),
  });

  const next = () => {
    if (step === 0 && !name.trim()) return setErr('Give the campaign a name so you can find it later.');
    if (step === 1 && !groupIds.length) return setErr('Choose at least one group.');
    if (step === 2 && !body.trim()) return setErr('Write your message.');
    if (step === 3 && later && (!when || new Date(when) < new Date())) return setErr('Pick a date and time in the future.');
    setStep((s) => Math.min(s + 1, 4));
  };

  const est = estimate.data;
  const cost = est ? Number(est.cost_tzs) : 0;
  const bal = balance.data ? Number(balance.data.balance_tzs) : null;
  const short = bal !== null && est ? cost > bal : false;

  return (
    <div className="animate-rise max-w-5xl">
      <div className="flex items-center gap-3 mb-5">
        <Link to="/app/campaigns" className="h-10 w-10 grid place-items-center rounded-xl hover:bg-ink/5 -ml-2" aria-label="Back to campaigns"><ChevronLeft className="h-5 w-5" /></Link>
        <h1 className="text-[24px] sm:text-[28px] font-extrabold tracking-tight">New campaign</h1>
      </div>

      {/* Stepper */}
      <ol className="flex items-center gap-1.5 sm:gap-2 mb-7" aria-label="Progress">
        {STEPS.map((s, i) => (
          <li key={s} className="flex-1">
            <button type="button" disabled={i > step} onClick={() => i < step && setStep(i)} className="w-full text-left group" aria-current={i === step ? 'step' : undefined}>
              <div className={cx('h-1.5 rounded-full transition-colors', i < step ? 'bg-brand' : i === step ? 'bg-amber' : 'bg-ink/10')} />
              <div className={cx('mt-2 text-[12px] sm:text-[13px] font-semibold', i === step ? 'text-ink' : i < step ? 'text-brand' : 'text-ink-300')}>
                <span className="sm:hidden">{i === step ? s : i + 1}</span><span className="hidden sm:inline">{i + 1}. {s}</span>
              </div>
            </button>
          </li>
        ))}
      </ol>

      <div className={cx('grid gap-8', step === 2 || step === 4 ? 'lg:grid-cols-[1fr_300px]' : '')}>
        <div className="panel p-5 sm:p-7">
          {step === 0 && (
            <div className="max-w-md">
              <h2 className="text-xl font-bold">What is this campaign about?</h2>
              <p className="text-ink-500 mt-1 mb-5">Only you see this name.</p>
              <Field error={err}><Input autoFocus value={name} onChange={(e) => setName(e.target.value)} invalid={!!err} placeholder="e.g. Term 3 fee reminder" onKeyDown={(e) => e.key === 'Enter' && next()} /></Field>
              <div className="mt-4 flex flex-wrap gap-2">
                {['Term 3 fee reminder', 'Exam results', 'Parents meeting', 'Weekend offer'].map((s) => (
                  <button key={s} type="button" onClick={() => setName(s)} className="h-9 px-3 rounded-full bg-paper border border-line text-sm hover:border-brand">{s}</button>
                ))}
              </div>
            </div>
          )}

          {step === 1 && (
            <div>
              <h2 className="text-xl font-bold">Who should get it?</h2>
              <p className="text-ink-500 mt-1 mb-5">Choose one or more groups. People in several groups get it only once.</p>
              {groups.isLoading ? <div className="grid sm:grid-cols-2 gap-3">{[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20" />)}</div>
                : !groups.data?.length ? (
                  <Empty icon={<Users className="h-6 w-6" />} title="You have no groups yet" body="Create a group like “Form 4 Parents” and add contacts to it first."
                    action={<Link to="/app/contacts?tab=groups" className="btn btn-md btn-primary">Go to contacts</Link>} />
                ) : (
                  <div className="grid sm:grid-cols-2 gap-3">
                    {groups.data.map((g) => {
                      const on = groupIds.includes(g.id);
                      return (
                        <button key={g.id} type="button" aria-pressed={on} onClick={() => setGroupIds(on ? groupIds.filter((x) => x !== g.id) : [...groupIds, g.id])}
                          className={cx('flex items-center gap-3 text-left rounded-2xl border-2 p-4 transition-colors', on ? 'border-brand bg-brand-50' : 'border-line hover:border-ink-300')}>
                          <span className={cx('h-6 w-6 rounded-md border-2 grid place-items-center shrink-0', on ? 'bg-brand border-brand text-white' : 'border-ink-300')}>{on && <Check className="h-4 w-4" />}</span>
                          <span className="min-w-0 flex-1">
                            <span className="block font-semibold truncate">{g.name}</span>
                            <span className="text-[13px] text-ink-500">{groupSize(g) !== undefined ? `${int(groupSize(g))} contacts` : g.description || 'Group'}</span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                )}
              {err && <p className="err">{err}</p>}
              {groupIds.length > 0 && roughRecipients > 0 && <p className="mt-4 text-sm text-ink-500">About <b className="text-ink">{int(roughRecipients)}</b> people selected.</p>}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              <div>
                <h2 className="text-xl font-bold">Write your message</h2>
                <p className="text-ink-500 mt-1">Tap <b>+ First name</b> to greet each person by name.</p>
              </div>
              <Field label="From (sender name)"><SenderSelect value={sender} onChange={setSender} approved={approved} /></Field>
              <Composer value={body} onChange={setBody} recipients={roughRecipients || 1} error={err} />
            </div>
          )}

          {step === 3 && (
            <div className="max-w-lg">
              <h2 className="text-xl font-bold">When should it go out?</h2>
              <div className="mt-5 grid sm:grid-cols-2 gap-3">
                {[{ v: false, icon: Zap, t: 'Send now', d: 'Starts right after you confirm' }, { v: true, icon: CalendarClock, t: 'Schedule', d: 'Pick a date and time' }].map(({ v, icon: Icon, t, d }) => (
                  <button key={t} type="button" aria-pressed={later === v} onClick={() => setLater(v)}
                    className={cx('text-left rounded-2xl border-2 p-4', later === v ? 'border-brand bg-brand-50' : 'border-line hover:border-ink-300')}>
                    <Icon className={cx('h-6 w-6', later === v ? 'text-brand' : 'text-ink-400')} />
                    <div className="mt-2 font-bold">{t}</div><div className="text-[13px] text-ink-500">{d}</div>
                  </button>
                ))}
              </div>
              {later && (
                <div className="mt-5"><Field label="Date & time" error={err} hint="Uses your phone’s time zone (East Africa Time)."><Input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} invalid={!!err} /></Field></div>
              )}
            </div>
          )}

          {step === 4 && (
            <div>
              <h2 className="text-xl font-bold">Check and confirm</h2>
              <dl className="mt-5 divide-y divide-line text-[15px]">
                <Row k="Campaign" v={name} />
                <Row k="Groups" v={(groups.data || []).filter((g) => groupIds.includes(g.id)).map((g) => g.name).join(', ')} />
                <Row k="From" v={sender} />
                <Row k="When" v={later ? new Date(when).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' }) : 'Right now'} />
                <Row k="Recipients" v={estimate.isLoading ? <Skeleton className="h-5 w-16" /> : est ? int(est.recipients) : '—'} />
                <Row k="SMS parts" v={estimate.isLoading ? <Skeleton className="h-5 w-16" /> : est ? `${int(est.segments)} total` : `${analyse(render(body)).segments} per person`} />
              </dl>
              <div className={cx('mt-5 rounded-2xl p-5 flex flex-wrap items-end justify-between gap-3', short ? 'bg-bad/5 border border-bad/30' : 'bg-paper border border-line')}>
                <div>
                  <div className="text-sm text-ink-500">Estimated cost</div>
                  {estimate.isLoading ? <Skeleton className="h-9 w-36 mt-1" /> : <div className="text-[32px] font-black tabular-nums leading-tight">{est ? tzs(est.cost_tzs) : '—'}</div>}
                </div>
                <div className="text-sm text-ink-500 text-right">Balance: <b className="text-ink">{bal !== null ? tzs(bal) : '—'}</b></div>
              </div>
              {estimate.isError && <p className="err">Could not calculate the cost: {errMsg(estimate.error)}</p>}
              {short && (
                <div className="mt-3 flex items-start gap-2 text-sm text-[#9b2c26]">
                  <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
                  <span>Your balance is too low for this campaign. <Link to="/app/wallet?topup=1" className="font-semibold underline">Top up</Link> first.</span>
                </div>
              )}
              <p className="mt-3 text-[13px] text-ink-500">People who replied STOP are skipped. Failed messages are refunded automatically.</p>
              {err && <p className="err" role="alert">{err}</p>}
            </div>
          )}

          <div className="mt-8 flex flex-col-reverse sm:flex-row gap-2 sm:justify-between">
            <div className="flex gap-2">
              {step > 0 && <Button variant="ghost" size="lg" onClick={() => setStep(step - 1)}>Back</Button>}
              {step >= 2 && <Button variant="ghost" size="lg" onClick={() => saveDraft.mutate()} loading={saveDraft.isPending}>Save draft</Button>}
            </div>
            {step < 4
              ? <Button size="lg" onClick={next} className="sm:min-w-[160px]">Continue</Button>
              : <Button size="lg" variant={later ? 'primary' : 'accent'} onClick={() => launch.mutate()} loading={launch.isPending} disabled={short || estimate.isLoading} className="sm:min-w-[200px]">
                  {later ? 'Schedule campaign' : `Tuma sasa · ${est ? tzs(est.cost_tzs) : ''}`}
                </Button>}
          </div>
        </div>

        {(step === 2 || step === 4) && (
          <aside className="lg:sticky lg:top-10 self-start">
            <p className="text-[13px] text-ink-500 text-center mb-3">Preview for a sample contact, Amina</p>
            <PhonePreview body={body} sender={sender} />
          </aside>
        )}
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return <div className="flex justify-between gap-6 py-3"><dt className="text-ink-500">{k}</dt><dd className="font-semibold text-right">{v}</dd></div>;
}
