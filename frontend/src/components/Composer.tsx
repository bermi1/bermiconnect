import { useMemo, useRef, useState } from 'react';
import { FileText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { AiHelp, GsmFixHint } from './AiHelp';
import { analyse, render, TAGS, PRICE_TZS } from '../lib/sms';
import { useTemplates } from '../lib/hooks';
import { PRESET_TEMPLATES } from '../lib/presets';
import { cx, Modal, Textarea } from './ui';
import { int, tzs } from '../lib/format';

export function SegmentMeter({ body, recipients = 1, compact }: { body: string; recipients?: number; compact?: boolean }) {
  const info = analyse(render(body));
  const used = info.segments === 0 ? 0 : info.perSegment - info.remaining;
  const ratio = info.segments === 0 ? 0 : used / info.perSegment;
  const cost = info.segments * PRICE_TZS * Math.max(recipients, 1);
  return (
    <div className={cx('rounded-xl bg-paper border border-line', compact ? 'p-3' : 'p-3.5')}>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] text-ink-500">
        <span><b className="text-ink tabular-nums">{info.length}</b> characters</span>
        <span><b className="text-ink tabular-nums">{info.segments}</b> SMS {info.segments === 1 ? 'part' : 'parts'}</span>
        <span className={cx('rounded-md px-1.5 py-0.5 text-[12px] font-semibold', info.encoding === 'UCS2' ? 'bg-amber-100 text-amber-700' : 'bg-brand-50 text-brand-700')}>
          {info.encoding === 'GSM7' ? 'Standard letters' : 'Special letters'}
        </span>
        <span className="ml-auto font-semibold text-ink tabular-nums">
          {recipients > 1 ? <>≈ {tzs(cost)} <span className="font-normal text-ink-500">for {int(recipients)}</span></> : <>{tzs(cost)} each</>}
        </span>
      </div>
      <div className="mt-2.5 flex gap-1" aria-hidden>
        {Array.from({ length: Math.max(info.segments, 1) }).map((_, i) => (
          <div key={i} className="h-1.5 flex-1 rounded-full bg-ink/10 overflow-hidden">
            <div className={cx('h-full rounded-full', info.encoding === 'UCS2' ? 'bg-amber' : 'bg-brand')}
              style={{ width: `${i < info.segments - 1 ? 100 : ratio * 100}%` }} />
          </div>
        ))}
      </div>
      <p className="mt-2 text-[12px] text-ink-500">
        {info.segments === 0
          ? `Up to 160 characters fit in one SMS (TZS ${PRICE_TZS}).`
          : info.encoding === 'UCS2'
            ? <>Special characters ({info.nonGsm.join(' ')}) shrink each SMS to 70 characters. {info.remaining} left in this part.</>
            : <>{info.remaining} characters left before the next SMS part.</>}
      </p>
    </div>
  );
}

export function PhonePreview({ body, sender }: { body: string; sender: string }) {
  const text = render(body);
  return (
    <div className="mx-auto w-full max-w-[300px] rounded-[38px] bg-ink p-2.5 shadow-lift">
      <div className="rounded-[30px] bg-[#EEF2EF] overflow-hidden">
        <div className="flex flex-col items-center pt-4 pb-3 bg-white/70 border-b border-line">
          <div className="h-10 w-10 rounded-full bg-brand text-white grid place-items-center text-sm font-bold">{(sender || 'B').slice(0, 1)}</div>
          <div className="mt-1 text-[13px] font-semibold">{sender || 'BERMI'}</div>
        </div>
        <div className="min-h-[220px] p-3 flex flex-col justify-end">
          <div className="text-center text-[11px] text-ink-400 mb-2">Today</div>
          {text.trim() ? (
            <div className="bubble max-w-[88%] whitespace-pre-wrap break-words">{text}</div>
          ) : (
            <div className="bubble max-w-[88%] text-ink-300">Your message appears here…</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function Composer({ value, onChange, recipients, error, extraTags = [], hideDefaultTags, noTemplates, rows = 6, placeholder }: { value: string; onChange: (v: string) => void; recipients?: number; error?: string | null; extraTags?: string[]; hideDefaultTags?: boolean; noTemplates?: boolean; rows?: number; placeholder?: string }) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const [pick, setPick] = useState(false);
  const tpl = useTemplates();
  const tags = useMemo(() => [...(hideDefaultTags ? [] : TAGS), ...extraTags.map((t) => ({ tag: `{{${t}}}`, label: t.replace(/_/g, ' ') }))], [extraTags, hideDefaultTags]);

  const insert = (s: string) => {
    const el = ref.current;
    if (!el) { onChange(value + s); return; }
    const a = el.selectionStart ?? value.length; const b = el.selectionEnd ?? value.length;
    const next = value.slice(0, a) + s + value.slice(b);
    onChange(next);
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(a + s.length, a + s.length); });
  };

  const all = [...(tpl.data || []).map((t) => ({ ...t, mine: true })), ...PRESET_TEMPLATES.map((t, i) => ({ id: `preset-${i}`, ...t, mine: false }))];

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2 mb-2">
        <AiHelp value={value} onUse={onChange} recipients={recipients} />
        {!noTemplates && <button type="button" onClick={() => setPick(true)} className="btn btn-sm btn-outline press"><FileText className="h-4 w-4" />Templates</button>}
      </div>
      {tags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 mb-2" aria-label="Insert a personal detail">
          <span className="text-[13px] text-ink-500 mr-0.5">Tap to insert:</span>
          {tags.map((t) => (
            <button key={t.tag} type="button" onClick={() => insert(t.tag)} className="press h-8 px-2.5 rounded-lg border border-dashed border-brand/40 text-brand-700 bg-brand-50/60 text-[13px] font-semibold hover:bg-brand-50 max-w-full truncate">
              + {t.label}
            </button>
          ))}
        </div>
      )}
      <Textarea ref={ref} rows={rows} value={value} onChange={(e) => onChange(e.target.value)} invalid={!!error}
        placeholder={placeholder ?? 'Habari {{first_name}}, ...'} aria-label="Message" className="text-base" />
      {error && <p className="err">{error}</p>}
      <GsmFixHint value={value} onChange={onChange} recipients={recipients} />
      <div className="mt-3"><SegmentMeter body={value} recipients={recipients} /></div>

      <Modal open={pick} onClose={() => setPick(false)} title="Pick a template" size="lg">
        <div className="grid gap-2.5">
          {all.map((t) => (
            <button key={t.id} type="button" onClick={() => { onChange(t.body); setPick(false); }}
              className="text-left rounded-2xl border border-line p-4 hover:border-brand hover:bg-brand-50/40 transition-colors">
              <div className="flex items-center gap-2">
                <span className="font-semibold">{t.name}</span>
                {!t.mine && <span className="text-[12px] rounded-md bg-amber-50 text-amber-700 px-1.5 py-0.5 font-medium">Example</span>}
              </div>
              <p className="mt-1 text-sm text-ink-500 line-clamp-2">{t.body}</p>
            </button>
          ))}
        </div>
      </Modal>
    </div>
  );
}

export function SenderSelect({ value, onChange, approved }: { value: string; onChange: (v: string) => void; approved: string[] }) {
  const opts = Array.from(new Set(['BERMI', ...approved]));
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="input">
      {opts.map((o) => <option key={o} value={o}>{o}{o === 'BERMI' ? ' (default)' : ''}</option>)}
    </select>
  );
}
