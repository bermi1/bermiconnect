import { useEffect, useRef, useState } from 'react';
import { Sparkles, Scissors, Languages, Smile, Briefcase, PenLine, X, Check, Wand2 } from 'lucide-react';
import { api, ApiError, errMsg } from '../lib/api';
import { analyse, gsmSuggestion, render, PRICE_TZS, type WriteAction } from '../lib/sms';
import { tzs, int } from '../lib/format';
import { Button, Spinner, cx } from './ui';

export interface AiResult { text: string; length: number; segments: number; encoding: 'GSM7' | 'UCS2'; warnings: string[]; demo?: boolean }

const OPTIONS: { action: WriteAction; label: string; icon: typeof Sparkles; needsText: boolean }[] = [
  { action: 'write', label: 'Write for me', icon: PenLine, needsText: false },
  { action: 'shorten', label: 'Shorten to 1 SMS', icon: Scissors, needsText: true },
  { action: 'swahili', label: 'Translate to Swahili', icon: Languages, needsText: true },
  { action: 'english', label: 'Translate to English', icon: Languages, needsText: true },
  { action: 'friendlier', label: 'Make friendlier', icon: Smile, needsText: true },
  { action: 'formal', label: 'Make more formal', icon: Briefcase, needsText: true },
];

/** "AI help" button + menu. The result is a suggestion the user can Use or Discard. Calls only api.post('/ai/write'). */
export function AiHelp({ value, onUse, recipients = 1 }: { value: string; onUse: (t: string) => void; recipients?: number }) {
  const [open, setOpen] = useState(false);
  const [writing, setWriting] = useState(false);
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState<WriteAction | null>(null);
  const [result, setResult] = useState<AiResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  const hasText = !!value.trim();

  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) { setOpen(false); setWriting(false); } };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);

  const run = async (action: WriteAction) => {
    setBusy(action); setError(null); setOpen(false); setWriting(false);
    try {
      const r = await api.post<AiResult>('/ai/write', action === 'write' ? { action, prompt: prompt.trim() } : { action, text: value });
      setResult(r);
    } catch (e) {
      setResult(null);
      setError(e instanceof ApiError && e.code === 'ai_not_configured' ? "AI help isn't switched on yet. You can still write and send as normal."
        : e instanceof ApiError && e.code === 'rate_limited' ? e.message : errMsg(e));
    } finally { setBusy(null); }
  };

  const people = Math.max(recipients, 1);
  const info = result ? analyse(render(result.text)) : null;

  return (
    <div className="relative" ref={ref}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} disabled={!!busy}
        className="btn btn-sm bg-brand text-white hover:bg-brand-700 press">
        {busy ? <Spinner /> : <Sparkles className="h-4 w-4 text-amber" />}AI help
      </button>
      {open && (
        <div className="absolute z-20 mt-1.5 left-0 w-[min(320px,calc(100vw-2rem))] rounded-2xl bg-white border border-line p-1.5 shadow-lift animate-pop origin-top-left" role="menu">
          {writing ? (
            <form className="p-2" onSubmit={(e) => { e.preventDefault(); if (prompt.trim()) run('write'); }}>
              <label htmlFor="ai-prompt" className="text-sm font-semibold">What should the message say?</label>
              <input id="ai-prompt" autoFocus value={prompt} onChange={(e) => setPrompt(e.target.value)} maxLength={300}
                placeholder="remind parents fees due Friday" className="input h-11 mt-2 text-[15px]" />
              <div className="mt-2 flex justify-end gap-2">
                <Button type="button" size="sm" variant="ghost" onClick={() => setWriting(false)}>Back</Button>
                <Button type="submit" size="sm" disabled={!prompt.trim()}>Write it</Button>
              </div>
            </form>
          ) : OPTIONS.map(({ action, label, icon: Icon, needsText }) => (
            <button key={action} type="button" role="menuitem" disabled={needsText && !hasText}
              onClick={() => (action === 'write' ? setWriting(true) : run(action))}
              className="w-full flex items-center gap-3 h-11 px-3 rounded-xl text-left text-[15px] font-medium hover:bg-paper disabled:opacity-40 disabled:hover:bg-transparent">
              <Icon className="h-4 w-4 text-brand" />{label}
            </button>
          ))}
          {!writing && !hasText && <p className="px-3 pb-2 pt-1 text-[12px] text-ink-500">Type a message first to shorten, translate or change its tone.</p>}
        </div>
      )}

      {error && (
        <div className="absolute z-10 mt-1.5 left-0 w-[min(340px,calc(100vw-2rem))] rounded-xl bg-white border border-line p-3 shadow-lift text-sm flex gap-2 animate-pop" role="status">
          <span className="flex-1 text-ink-700">{error}</span>
          <button type="button" onClick={() => setError(null)} aria-label="Dismiss" className="text-ink-400 hover:text-ink"><X className="h-4 w-4" /></button>
        </div>
      )}

      {result && info && (
        <AiSuggestion result={result} people={people} onUse={() => { onUse(result.text); setResult(null); }} onDiscard={() => setResult(null)} />
      )}
    </div>
  );
}

function AiSuggestion({ result, people, onUse, onDiscard }: { result: AiResult; people: number; onUse: () => void; onDiscard: () => void }) {
  const info = analyse(render(result.text));
  return (
    <div className="fixed sm:absolute z-40 inset-x-3 bottom-24 sm:bottom-auto sm:inset-x-auto sm:left-0 sm:mt-2 sm:w-[min(440px,calc(100vw-3rem))] rounded-2xl bg-white border-2 border-brand/20 shadow-2xl p-4 animate-pop" role="dialog" aria-label="AI suggestion">
      <div className="flex items-center gap-2 text-[13px] font-semibold text-brand">
        <Sparkles className="h-4 w-4 text-amber" />Suggestion
        {result.demo && <span className="rounded-md bg-amber-100 text-amber-700 px-1.5 py-0.5 text-[12px]">Demo sample, not real AI</span>}
      </div>
      <p className="mt-2 text-[15px] leading-relaxed whitespace-pre-wrap break-words">{result.text}</p>
      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-ink-500 tabular-nums">
        <span>{info.length} characters</span>
        <span className={cx('font-semibold', info.segments === 1 ? 'text-ok' : 'text-amber-700')}>{info.segments} SMS</span>
        <span>{people > 1 ? `${tzs(info.segments * PRICE_TZS * people)} for ${int(people)}` : `${tzs(info.segments * PRICE_TZS)} each`}</span>
      </div>
      {result.warnings.length > 0 && (
        <ul className="mt-2 space-y-1 text-[13px] text-amber-700">{result.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
      )}
      <p className="mt-2 text-[12px] text-ink-400">Check names, dates and amounts before you send.</p>
      <div className="mt-3 flex gap-2">
        <Button size="sm" onClick={onUse} icon={<Check className="h-4 w-4" />}>Use this</Button>
        <Button size="sm" variant="ghost" onClick={onDiscard}>Discard</Button>
      </div>
    </div>
  );
}

/** One-tap "Fix special characters" suggestion. Shown only when the fix changes something. */
export function GsmFixHint({ value, onChange, recipients = 1 }: { value: string; onChange: (v: string) => void; recipients?: number }) {
  const s = gsmSuggestion(value, recipients);
  if (!s) return null;
  const perPerson = s.before.segments - s.after.segments;
  const n = s.changed;
  return (
    <button type="button" onClick={() => onChange(s.text)}
      className="press mt-2 w-full flex items-start gap-3 text-left rounded-xl border border-amber/50 bg-amber-50 px-3.5 py-2.5 hover:bg-amber-100">
      <Wand2 className="h-4 w-4 mt-0.5 text-amber-700 shrink-0" />
      <span className="text-[14px] leading-snug">
        <b>Fix {n} special character{n === 1 ? '' : 's'}</b> ({s.chars.slice(0, 5).join(' ')})
        {perPerson > 0
          ? <> and save {perPerson} SMS per person{recipients > 1 ? ` (${tzs(perPerson * PRICE_TZS * recipients)})` : ''}</>
          : s.after.encoding === 'GSM7' && s.before.encoding === 'UCS2' ? <> so your message uses standard SMS letters</> : <> with plain SMS letters</>}
        {s.remaining.length > 0 && <span className="block text-[12px] text-ink-500">Emoji ({s.remaining.join(' ')}) still need Unicode. Remove them to save more.</span>}
      </span>
    </button>
  );
}
