import { useMemo, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { FileSpreadsheet, Upload, AlertTriangle, CheckCircle2, ChevronDown, Info } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import { useBalance, useSenderIds } from '../lib/hooks';
import { analyse, PRICE_TZS } from '../lib/sms';
import { int, tzs } from '../lib/format';
import { buildSend, columnsFor, defaultGroupName, detectHeaderRow, guessColumns, readWorkbook, type Workbook } from '../lib/sheet';
import { Composer, SenderSelect } from '../components/Composer';
import { Button, Field, Input, PageHeader, Select, Toggle, cx } from '../components/ui';
import { useToast } from '../components/Toast';

interface FromFileResult { id: string; messages: number; total_cost_tzs: number; contacts?: { group_name: string; created: number; updated: number } }

const segs = (t: string) => analyse(t).segments;

export default function SendFromExcel() {
  const [wb, setWb] = useState<Workbook | null>(null);
  const [sheetIdx, setSheetIdx] = useState(0);
  const [headerRow, setHeaderRow] = useState(0);
  const [phoneCol, setPhoneCol] = useState<number | null>(null);
  const [phone2Col, setPhone2Col] = useState<number | null>(null);
  const [nameCol, setNameCol] = useState<number | null>(null);
  const [body, setBody] = useState('');
  const [sender, setSender] = useState('BERMI');
  const [saveContacts, setSaveContacts] = useState(false);
  const [groupName, setGroupName] = useState('');
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showProblems, setShowProblems] = useState(true);
  const [showSetup, setShowSetup] = useState(false);
  const [sendErr, setSendErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const toast = useToast();
  const nav = useNavigate();
  const qc = useQueryClient();
  const balance = useBalance();
  const senders = useSenderIds();
  const approved = (senders.data || []).filter((s) => s.status === 'approved').map((s) => s.name);

  const sheet = wb?.sheets[sheetIdx] ?? null;
  const cols = useMemo(() => (sheet ? columnsFor(sheet, headerRow) : []), [sheet, headerRow]);

  const applySheet = (w: Workbook, idx: number) => {
    const s = w.sheets[idx];
    const h = detectHeaderRow(s);
    const c = columnsFor(s, h);
    const g = guessColumns(s, h, c);
    setSheetIdx(idx); setHeaderRow(h); setPhoneCol(g.phone); setPhone2Col(g.phone2); setNameCol(g.name);
    setShowSetup(g.phone === null);
  };

  const onFile = async (f: File | undefined) => {
    if (!f) return;
    setLoadErr(null); setLoading(true);
    try {
      if (!/\.(xlsx|xls|csv|txt)$/i.test(f.name)) throw new Error('Choose an Excel file (.xlsx or .xls) or a .csv file.');
      if (f.size > 15 * 1024 * 1024) throw new Error('This file is over 15 MB. Save only the sheet you need and try again.');
      const w = await readWorkbook(f);
      if (!w.sheets.length) throw new Error('This file looks empty.');
      setWb(w); setGroupName(defaultGroupName(f.name)); applySheet(w, 0);
    } catch (e) {
      setWb(null);
      setLoadErr(e instanceof Error ? e.message : 'Could not read this file.');
    } finally { setLoading(false); if (fileRef.current) fileRef.current.value = ''; }
  };

  const built = useMemo(() => {
    if (!sheet || phoneCol === null) return null;
    return buildSend(sheet, headerRow, cols, phoneCol, phone2Col, nameCol, body, segs);
  }, [sheet, headerRow, cols, phoneCol, phone2Col, nameCol, body]);

  const cost = built ? built.segments * PRICE_TZS : 0;
  const bal = balance.data ? Number(balance.data.balance_tzs) : null;
  const short = bal !== null && cost > bal;
  const missingTags = useMemo(() => {
    const names = new Set(cols.map((c) => c.name.toLowerCase()));
    return [...body.matchAll(/\{\{\s*([^{}]+?)\s*\}\}/g)].map((m) => m[1].trim()).filter((t) => !names.has(t.toLowerCase()));
  }, [body, cols]);

  const send = useMutation({
    mutationFn: () => api.post<FromFileResult>('/campaigns/from-file', {
      name: `${defaultGroupName(wb!.fileName)}${wb!.sheets.length > 1 ? ` (${sheet!.name})` : ''}`,
      sender_id: sender,
      template: body,
      rows: built!.rows.map((r) => ({ to: r.to, message: r.message, ref: r.ref, ...(saveContacts ? { fields: r.fields } : {}) })),
      ...(saveContacts ? { save_contacts: { group_name: groupName.trim() || defaultGroupName(wb!.fileName), name_column: nameCol !== null ? cols.find((c) => c.index === nameCol)?.name : null } } : {}),
    }),
    onSuccess: (r) => {
      toast.success(`Sending ${int(r.messages)} messages.${r.contacts ? ` Saved to "${r.contacts.group_name}".` : ''}`);
      ['campaigns', 'balance', 'stats', 'groups'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      nav(`/app/campaigns/${r.id}`);
    },
    onError: (e) => setSendErr(errMsg(e)),
  });

  const canSend = !!built && built.rows.length > 0 && !!body.trim() && !short && missingTags.length === 0 && built.rows.length <= 10000;

  /* ---------------------------------------------------------------- upload */
  if (!wb) {
    return (
      <div className="animate-rise max-w-3xl">
        <PageHeader title="Send from Excel" subtitle="Each row in your sheet becomes one personal SMS, like results to every parent." />
        <label
          onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); onFile(e.dataTransfer.files?.[0]); }}
          className={cx('press block cursor-pointer rounded-3xl border-2 border-dashed p-8 sm:p-14 text-center transition-colors',
            drag ? 'border-brand bg-brand-50' : 'border-ink-300 bg-white hover:border-brand')}>
          <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv" className="sr-only" onChange={(e) => onFile(e.target.files?.[0])} data-testid="file-input" />
          <span className="mx-auto h-16 w-16 rounded-2xl bg-brand text-white grid place-items-center"><FileSpreadsheet className="h-8 w-8" /></span>
          <span className="mt-5 block text-xl font-bold">{loading ? 'Reading your file…' : 'Choose your Excel file'}</span>
          <span className="mt-1 block text-ink-500">or drop it here. .xlsx, .xls or .csv</span>
          <span className="btn btn-lg btn-primary mt-6 pointer-events-none"><Upload className="h-5 w-5" />Choose file</span>
        </label>
        {loadErr && <p className="err mt-3" role="alert">{loadErr}</p>}
        <ul className="mt-8 grid sm:grid-cols-3 gap-4 text-[15px]">
          {[['Your file stays on this device', 'Nothing is sent until you press Send.'], ['Any layout', 'Title rows, Swahili or English headings, numbers in any format.'], ['You check first', 'See the first messages, the total cost and any missing numbers.']].map(([t, d]) => (
            <li key={t}><b className="block">{t}</b><span className="text-ink-500">{d}</span></li>
          ))}
        </ul>
      </div>
    );
  }

  /* ---------------------------------------------------------------- set up + preview */
  const colName = (i: number | null) => (i === null ? '' : cols.find((c) => c.index === i)?.name ?? '');
  const firstThree = built?.rows.slice(0, 3) ?? [];

  return (
    <div className="animate-rise">
      <PageHeader title="Send from Excel"
        subtitle={<span className="inline-flex items-center gap-2 flex-wrap"><FileSpreadsheet className="h-4 w-4 text-brand" /><b className="text-ink">{wb.fileName}</b>
          <button type="button" onClick={() => { setWb(null); setBody(''); }} className="text-brand font-semibold">Choose another file</button></span>} />

      <div className="grid lg:grid-cols-[1fr_380px] gap-6 items-start">
        <div className="space-y-5 min-w-0">
          {/* Sheet + columns */}
          <section className="panel p-5 sm:p-6">
            {wb.sheets.length > 1 && (
              <div className="mb-5">
                <span className="field-label">Which sheet?</span>
                <div className="flex flex-wrap gap-2">
                  {wb.sheets.map((s, i) => (
                    <button key={s.name} type="button" onClick={() => applySheet(wb, i)} aria-pressed={i === sheetIdx}
                      className={cx('press h-10 px-4 rounded-full border-2 text-sm font-semibold', i === sheetIdx ? 'border-brand bg-brand-50 text-brand-800' : 'border-line bg-white')}>
                      {s.name} <span className="font-normal text-ink-500">({s.rowCount} rows)</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold text-lg">Phone numbers</h2>
                {phoneCol !== null
                  ? <p className="text-ink-500 text-[15px]">From the column <b className="text-ink">{colName(phoneCol)}</b>{phone2Col !== null && <>, or <b className="text-ink">{colName(phone2Col)}</b> if that is empty</>}.</p>
                  : <p className="text-[#9b2c26] text-[15px]">We could not find a phone column. Pick it below.</p>}
              </div>
              <Button size="sm" variant="outline" onClick={() => setShowSetup((v) => !v)} aria-expanded={showSetup}>
                {showSetup ? 'Done' : 'Change'}<ChevronDown className={cx('h-4 w-4 transition-transform', showSetup && 'rotate-180')} />
              </Button>
            </div>
            {showSetup && (
              <div className="mt-5 grid sm:grid-cols-2 gap-4 animate-pop">
                <Field label="Phone column">
                  <Select value={phoneCol ?? ''} onChange={(e) => setPhoneCol(e.target.value === '' ? null : Number(e.target.value))} aria-label="Phone column">
                    <option value="">Choose…</option>
                    {cols.map((c) => <option key={c.index} value={c.index}>{c.name}</option>)}
                  </Select>
                </Field>
                <Field label="Second phone (if the first is empty)">
                  <Select value={phone2Col ?? ''} onChange={(e) => setPhone2Col(e.target.value === '' ? null : Number(e.target.value))} aria-label="Second phone column">
                    <option value="">None</option>
                    {cols.filter((c) => c.index !== phoneCol).map((c) => <option key={c.index} value={c.index}>{c.name}</option>)}
                  </Select>
                </Field>
                <Field label="Headings are in row" hint="Rows above it (titles) are skipped.">
                  <Select value={headerRow} onChange={(e) => setHeaderRow(Number(e.target.value))} aria-label="Heading row">
                    {sheet!.text.slice(0, 20).map((r, i) => r.some((x) => x.trim()) && (
                      <option key={i} value={i}>Row {sheet!.firstRow + i}: {r.filter((x) => x.trim()).slice(0, 3).join(', ').slice(0, 50)}</option>
                    ))}
                  </Select>
                </Field>
                <Field label="Name column (for your records)">
                  <Select value={nameCol ?? ''} onChange={(e) => setNameCol(e.target.value === '' ? null : Number(e.target.value))} aria-label="Name column">
                    <option value="">None</option>
                    {cols.map((c) => <option key={c.index} value={c.index}>{c.name}</option>)}
                  </Select>
                </Field>
              </div>
            )}
          </section>

          {/* Message */}
          <section className="panel p-5 sm:p-6">
            <h2 className="font-bold text-lg">Message</h2>
            <p className="text-ink-500 text-[15px] mb-4">Tap a column name to put each person’s own value in the message.</p>
            <Composer value={body} onChange={setBody} recipients={built?.rows.length || 1} extraTags={cols.map((c) => c.name)} hideDefaultTags rows={5}
              placeholder={`Mzazi wa {{${colName(nameCol) || cols[0]?.name || 'Name'}}}: ...`} />
            {missingTags.length > 0 && <p className="err">No column called {missingTags.map((t) => `{{${t}}}`).join(', ')}. Tap a column name above instead.</p>}
            <div className="mt-5">
              <span className="field-label">From (sender name)</span>
              <SenderSelect value={sender} onChange={setSender} approved={approved} />
            </div>
          </section>

          {/* Problems */}
          {built && (built.unsendable.length > 0 || built.warnings.length > 0) && (
            <section className="panel overflow-hidden" data-testid="problems">
              <button type="button" onClick={() => setShowProblems((v) => !v)} className="w-full flex items-center justify-between gap-3 px-5 sm:px-6 py-4 text-left">
                <span className="flex items-center gap-2 font-bold text-lg"><AlertTriangle className="h-5 w-5 text-amber-600" />
                  {built.unsendable.length} {built.unsendable.length === 1 ? 'row' : 'rows'} can’t be sent{built.warnings.length > 0 && <span className="font-semibold text-ink-500 text-[15px]">· {built.warnings.length} to check</span>}
                </span>
                <ChevronDown className={cx('h-5 w-5 text-ink-400 transition-transform', showProblems && 'rotate-180')} />
              </button>
              {showProblems && (
                <ul className="divide-y divide-line border-t border-line">
                  {[...built.unsendable.map((p) => ({ ...p, bad: true })), ...built.warnings.map((p) => ({ ...p, bad: false }))].sort((a, b) => a.row - b.row).map((p) => (
                    <li key={`${p.row}-${p.bad}`} className="px-5 sm:px-6 py-3 flex gap-3 text-[15px]">
                      <span className={cx('shrink-0 h-6 min-w-[64px] px-2 rounded-md text-[12px] font-bold grid place-items-center tabular-nums', p.bad ? 'bg-bad/10 text-[#9b2c26]' : 'bg-amber-100 text-amber-700')}>Row {p.row}</span>
                      <span className="min-w-0">
                        <span className="font-semibold">{p.name || '—'}</span>{p.raw && <span className="text-ink-500 tabular-nums"> · “{p.raw}”</span>}
                        <span className={cx('block text-[14px]', p.bad ? 'text-[#9b2c26]' : 'text-amber-700')}>{p.reason}</span>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}
        </div>

        {/* Summary + preview */}
        <aside className="lg:sticky lg:top-8 space-y-4 min-w-0">
          <section className="rounded-3xl bg-ink text-white p-5 sm:p-6" data-testid="totals">
            <div className="grid grid-cols-2 gap-y-4 gap-x-3">
              <Stat label="Will get an SMS" value={built ? int(built.rows.length) : '—'} big />
              <Stat label="Can’t be sent" value={built ? int(built.unsendable.length) : '—'} tone={built?.unsendable.length ? 'bad' : undefined} big />
              <Stat label="SMS in total" value={built && body.trim() ? int(built.segments) : '—'} />
              <Stat label="Cost" value={built && body.trim() ? tzs(cost) : '—'} />
            </div>
            <p className="mt-4 text-[13px] text-white/60">
              {built ? `${int(built.total)} rows in “${sheet!.name}”. ` : ''}Balance {bal !== null ? tzs(bal) : '—'}. Failed messages are refunded.
            </p>
            {short && <p className="mt-2 text-[14px] text-amber">Not enough balance. <Link to="/app/wallet?topup=1" className="underline font-semibold">Top up</Link> first.</p>}
            {built && built.rows.length > 10000 && <p className="mt-2 text-[14px] text-amber">You can send up to 10,000 rows at a time. Split the sheet.</p>}

            <label className="mt-5 flex items-center justify-between gap-3 rounded-2xl bg-white/[0.07] px-4 py-3">
              <span className="text-[15px] font-medium">Also save these numbers to Contacts</span>
              <Toggle checked={saveContacts} onChange={setSaveContacts} label="Also save these numbers to Contacts" />
            </label>
            {saveContacts && (
              <div className="mt-2 animate-pop">
                <label htmlFor="grp" className="text-[13px] text-white/60">Group name</label>
                <Input id="grp" value={groupName} onChange={(e) => setGroupName(e.target.value)} className="mt-1 bg-white/95" />
              </div>
            )}
            <Button size="lg" variant="accent" className="w-full mt-5" disabled={!canSend} loading={send.isPending}
              onClick={() => { setSendErr(null); send.mutate(); }} data-testid="send">
              {built?.rows.length ? `Send ${int(built.rows.length)} SMS · ${tzs(cost)}` : 'Send'}
            </Button>
            {!body.trim() && <p className="mt-2 text-[13px] text-white/60 text-center">Write your message to continue.</p>}
            {sendErr && <p className="mt-2 text-[14px] text-[#ffb3ad]" role="alert">{sendErr}</p>}
          </section>

          <section className="panel p-4 sm:p-5" data-testid="preview">
            <h2 className="font-bold">How the first messages look</h2>
            {!body.trim() || !firstThree.length ? (
              <p className="mt-2 text-sm text-ink-500 flex gap-2"><Info className="h-4 w-4 shrink-0 mt-0.5" />Your first three messages appear here as you type.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {firstThree.map((r) => {
                  const a = analyse(r.message);
                  return (
                    <li key={r.ref} className="animate-pop">
                      <div className="flex justify-between text-[12px] text-ink-500 mb-1 gap-2"><span className="truncate">Row {r.rowNumber}{r.name && ` · ${r.name}`}</span><span className="tabular-nums shrink-0">{r.to}</span></div>
                      <div className="bubble-out text-[14px] whitespace-pre-wrap break-words">{r.message}</div>
                      <div className={cx('mt-1 text-[12px] tabular-nums', a.segments > 1 ? 'text-amber-700 font-semibold' : 'text-ink-500')}>{a.length} characters · {a.segments} SMS</div>
                    </li>
                  );
                })}
              </ul>
            )}
            {built && built.fixedChars > 0 && <p className="mt-3 text-[12px] text-ink-500 flex gap-1.5"><CheckCircle2 className="h-3.5 w-3.5 mt-0.5 text-ok shrink-0" />{built.fixedChars} special characters in the sheet were changed to plain letters to keep costs down.</p>}
          </section>
        </aside>
      </div>
    </div>
  );
}

function Stat({ label, value, big, tone }: { label: string; value: string; big?: boolean; tone?: 'bad' }) {
  return (
    <div className="min-w-0">
      <div className="text-[13px] text-white/60">{label}</div>
      <div className={cx('font-black tabular-nums leading-tight truncate', big ? 'text-[34px]' : 'text-xl', tone === 'bad' && 'text-[#ffb3ad]')}>{value}</div>
    </div>
  );
}
