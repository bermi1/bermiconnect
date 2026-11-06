import { Link } from 'react-router-dom';
import { useEffect, useState } from 'react';
import {
  MessageSquareText, ShieldCheck, MessageCircle, PhoneCall, Hash, Mail, Sparkles, Languages, Route, Inbox,
  GraduationCap, Store, Code2, Landmark, CheckCheck, ArrowRight, Radio,
} from 'lucide-react';
import { Logo, LogoMark } from '../components/Logo';
import { cx } from '../components/ui';
import { DOCS_URL } from '../lib/api';
import { analyse, PRICE_TZS } from '../lib/sms';

type Status = 'live' | 'early';
const CHANNELS: { icon: typeof Hash; name: string; status: Status; line: string; detail: string }[] = [
  { icon: MessageSquareText, name: 'SMS', status: 'live', line: 'Bulk campaigns and single sends to every Tanzanian network.', detail: 'Sender names, scheduling, delivery reports, STOP handling' },
  { icon: ShieldCheck, name: 'Verify (OTP)', status: 'live', line: 'One-time codes for sign-ups, logins and payments.', detail: 'Expiry, attempt limits, test keys that never charge' },
  { icon: MessageCircle, name: 'WhatsApp', status: 'early', line: 'Templates, rich media and two-way chat on WhatsApp Business.', detail: 'Falls back to SMS when a number has no WhatsApp' },
  { icon: PhoneCall, name: 'Voice & IVR', status: 'early', line: 'Recorded or spoken announcements and press-1 menus.', detail: 'For people who don’t read texts' },
  { icon: Hash, name: 'USSD', status: 'early', line: '*150# style menus that work on any phone, no data needed.', detail: 'Balances, surveys, registrations' },
  { icon: Mail, name: 'Email', status: 'early', line: 'Receipts, statements and newsletters from the same contacts.', detail: 'One contact list for every channel' },
];

const AI: { icon: typeof Hash; title: string; body: string }[] = [
  { icon: Sparkles, title: 'Writes it', body: 'Describe what you need in a sentence. Get a clear message in Swahili or English, sized to fit one SMS so it costs less.' },
  { icon: Languages, title: 'Translates it', body: 'Send each person the version in the language they read best, from one draft.' },
  { icon: Route, title: 'Routes it', body: 'Picks the channel that will reach each person: WhatsApp first, then SMS, then a voice call for anyone who didn’t open it.' },
  { icon: Inbox, title: 'Reads the replies', body: 'Sorts incoming replies into “paid”, “question”, “wrong number” and “stop”, so your team only answers what needs a person.' },
];

const NETWORKS = ['Vodacom', 'Yas', 'Airtel', 'Halotel', 'TTCL'];

/* Hero: one message moving through the intelligence layer to each channel. */
const ROUTE_ROWS = [
  { icon: MessageCircle, ch: 'WhatsApp', who: 'Mama Neema', result: 'Read', tone: 'ok' },
  { icon: MessageSquareText, ch: 'SMS', who: 'Baba Juma', result: 'Delivered', tone: 'ok' },
  { icon: MessageSquareText, ch: 'SMS · Swahili', who: 'Mzee Mushi', result: 'Delivered', tone: 'ok' },
  { icon: PhoneCall, ch: 'Voice call', who: 'Bibi Zawadi', result: 'Answered', tone: 'ok' },
  { icon: Inbox, ch: 'Reply', who: 'Mama Baraka', result: '“Nimelipa” → Paid', tone: 'amber' },
] as const;

function HeroRouter() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { setStep(ROUTE_ROWS.length + 1); return; }
    const t = setInterval(() => setStep((s) => (s > ROUTE_ROWS.length + 6 ? 0 : s + 1)), 650);
    return () => clearInterval(t);
  }, []);
  const lit = step >= 1;
  return (
    <div className="relative rounded-[28px] bg-brand-900 text-white p-5 sm:p-6 shadow-[0_30px_60px_-30px_rgba(12,11,39,.6)] overflow-hidden">
      <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-brand-500/30 blur-3xl" />
      <div className="relative flex items-center justify-between text-[12px] text-white/55 font-medium uppercase tracking-[0.12em]">
        <span>Example · fee reminder</span>
        <span className="flex items-center gap-1.5"><Radio className="h-3.5 w-3.5 text-amber" />Bermi Intelligence</span>
      </div>

      <div className="relative mt-4 rounded-2xl bg-white/[0.07] border border-white/10 p-4">
        <div className="text-[12px] text-white/50">You typed</div>
        <div className="mt-1 text-[15px] leading-snug">Remind Form 4 parents that term 3 fees are due Friday.</div>
      </div>

      <div className={cx('relative mx-auto my-3 flex w-fit items-center gap-2 rounded-full px-3 h-8 text-[12px] font-semibold transition-colors duration-500', lit ? 'bg-amber text-ink' : 'bg-white/10 text-white/60')}>
        <Sparkles className="h-3.5 w-3.5" />Written, translated and routed for 312 parents
      </div>

      <ul className="relative space-y-2">
        {ROUTE_ROWS.map((r, i) => {
          const on = step > i + 1;
          const Icon = r.icon;
          return (
            <li key={r.who} className={cx('flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-500', on ? 'bg-white/[0.09] translate-x-0 opacity-100' : 'bg-white/[0.03] opacity-60')}>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/10"><Icon className="h-4 w-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-sm font-semibold">{r.who}</div>
                <div className="text-[12px] text-white/50">{r.ch}</div>
              </div>
              <span className={cx('shrink-0 text-[13px] font-semibold transition-colors duration-500', !on ? 'text-white/30' : r.tone === 'amber' ? 'text-amber' : 'text-[#7fe0b8]')}>
                {on ? r.result : 'Routing…'}
              </span>
            </li>
          );
        })}
      </ul>
      <p className="relative mt-4 text-[12px] text-white/45">Illustration of the intelligence layer in development. Today, Bermi Connect sends SMS and verification codes.</p>
    </div>
  );
}

function StatusPill({ status }: { status: Status }) {
  return status === 'live'
    ? <span className="inline-flex items-center gap-1.5 rounded-full bg-ok/10 px-2.5 h-6 text-[12px] font-semibold text-ok"><span className="h-1.5 w-1.5 rounded-full bg-ok" />Live</span>
    : <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 h-6 text-[12px] font-semibold text-amber-700">Early access</span>;
}

/* AI example: the same notice, long vs. tightened. Segment counts are computed, not typed. */
const LONG = 'Dear parent, we would like to kindly remind you that the school fees for term three are due this coming Friday. Please make sure that you pay through the school bank account before the deadline. Thank you very much for your cooperation. 🙏';
const SHORT = 'Habari mzazi, ada ya muhula wa 3 inadaiwa kabla ya Ijumaa. Lipa kupitia akaunti ya shule. Asante.';

function AiExample() {
  const a = analyse(LONG); const b = analyse(SHORT);
  const people = 312;
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {[{ label: 'First draft', t: LONG, s: a, muted: true }, { label: 'After Bermi Intelligence', t: SHORT, s: b, muted: false }].map((x) => (
        <div key={x.label} className={cx('flex flex-col rounded-2xl border p-4', x.muted ? 'border-white/10 bg-white/[0.04]' : 'border-amber/40 bg-amber/[0.08]')}>
          <div className={cx('text-[12px] font-semibold uppercase tracking-[0.12em]', x.muted ? 'text-white/45' : 'text-amber')}>{x.label}</div>
          <p className="mt-2 text-[14px] leading-relaxed text-white/85">{x.t}</p>
          <div className="mt-auto pt-4 flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px] tabular-nums text-white/60">
            <span>{x.s.length} chars · {x.s.encoding} · {x.s.segments} SMS</span>
            <span className={cx('font-bold whitespace-nowrap', x.muted ? 'text-white/80' : 'text-amber')}>TZS {(x.s.segments * PRICE_TZS * people).toLocaleString()}</span>
          </div>
        </div>
      ))}
      <p className="sm:col-span-2 text-[13px] text-white/50">Example for 312 parents at TZS {PRICE_TZS} per SMS. The emoji in the first draft forces Unicode, which shrinks each SMS to 70 characters.</p>
    </div>
  );
}

function CostPlayground() {
  const [text, setText] = useState('Karibu! Parents meeting this Saturday at 9:00 AM in the school hall.');
  const [people, setPeople] = useState(300);
  const info = analyse(text);
  return (
    <div className="grid lg:grid-cols-[1.2fr_1fr] gap-4 items-stretch">
      <div className="rounded-3xl bg-white border border-line p-5 sm:p-7">
        <label htmlFor="pg" className="text-sm font-semibold text-ink-700">Type your message</label>
        <textarea id="pg" value={text} onChange={(e) => setText(e.target.value)} rows={4} className="input mt-2 text-base" />
        <label htmlFor="pp" className="mt-5 flex justify-between text-sm font-semibold text-ink-700">
          <span>How many people?</span><span className="tabular-nums text-ink">{people.toLocaleString()}</span>
        </label>
        <input id="pp" type="range" min={10} max={5000} step={10} value={people} onChange={(e) => setPeople(+e.target.value)} className="mt-3 w-full accent-[#201F5B]" />
      </div>
      <div className="rounded-3xl bg-brand text-white p-6 sm:p-7 flex flex-col">
        <div className="text-white/70 text-sm">You would pay</div>
        <div className="mt-1 text-[44px] sm:text-[56px] font-black leading-none tabular-nums tracking-tight">
          TZS {(info.segments * PRICE_TZS * people).toLocaleString()}
        </div>
        <div className="mt-4 text-[15px] text-white/80 leading-relaxed">
          {info.length} characters = {info.segments} SMS {info.segments === 1 ? 'part' : 'parts'} × TZS {PRICE_TZS} × {people.toLocaleString()} people.
          {info.encoding === 'UCS2' && ' Emoji make each part shorter (70 characters).'}
        </div>
        <Link to="/register" className="btn btn-lg btn-accent mt-6 self-start">Create free account</Link>
      </div>
    </div>
  );
}

const AUDIENCES = [
  { icon: GraduationCap, title: 'Schools', body: 'Fees, results and meeting notices to every parent, in the language they read.' },
  { icon: Store, title: 'Businesses', body: 'Offers, order updates and reminders under your own sender name.' },
  { icon: Landmark, title: 'SACCOs, NGOs & health', body: 'Repayment reminders, field alerts and appointment notices that reach basic phones.' },
  { icon: Code2, title: 'Developers', body: 'A clean REST API, signed webhooks, test keys and SDKs for JS, Python and PHP.' },
];

const CODE = `curl -X POST https://api.bermiconnect.co.tz/v1/sms/send \\
  -H "Authorization: Bearer bc_live_xxxxxxxx" \\
  -H "Content-Type: application/json" \\
  -d '{
    "to": ["0754123456", "+255713000111"],
    "message": "Your Bermi code is 482913",
    "sender_id": "BERMI"
  }'`;

const H2 = 'text-[32px] sm:text-[46px] font-extrabold tracking-[-0.035em] leading-[1.05] [text-wrap:balance]';
const EYEBROW = 'text-[12px] font-bold uppercase tracking-[0.16em]';

export default function Landing() {
  return (
    <div className="bg-paper text-ink">
      <header className="sticky top-0 z-30 bg-paper/85 backdrop-blur border-b border-line/60">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/"><Logo /></Link>
          <nav className="hidden md:flex items-center gap-7 text-[15px] text-ink-700 font-medium">
            <a href="#platform" className="hover:text-ink">Platform</a>
            <a href="#intelligence" className="hover:text-ink">Intelligence</a>
            <a href="#pricing" className="hover:text-ink">Pricing</a>
            <a href="#developers" className="hover:text-ink">Developers</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link to="/login" className="btn btn-md btn-ghost">Log in</Link>
            <Link to="/register" className="btn btn-md btn-primary hidden sm:inline-flex">Start free</Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 pt-12 sm:pt-20 pb-16 grid lg:grid-cols-[1.1fr_1fr] gap-12 lg:gap-16 items-center">
        <div className="min-w-0">
          <p className={cx(EYEBROW, 'text-brand flex items-center gap-2')}>
            <LogoMark className="h-4 w-5" />Bermi Techs · Communication Intelligence
          </p>
          <h1 className="mt-5 text-[46px] leading-[0.98] sm:text-[70px] lg:text-[78px] font-black tracking-[-0.045em] [text-wrap:balance]">
            Reach everyone. <span className="text-brand">In every channel.</span> In their language.
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-ink-500 max-w-[40ch] leading-relaxed">
            Bermi Connect is one communication layer for SMS, verification codes, WhatsApp, voice and USSD, with AI that writes, translates and routes every message. Built in Dar es Salaam, starting with SMS at TZS {PRICE_TZS}.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row gap-3">
            <Link to="/register" className="btn btn-lg btn-primary">Start free <ArrowRight className="h-5 w-5" /></Link>
            <a href="#intelligence" className="btn btn-lg btn-outline">See the intelligence layer</a>
          </div>
          <p className="mt-4 text-sm text-ink-500">TZS 500 free credit. Top up with M-Pesa, Tigo Pesa, Airtel Money or card.</p>
        </div>
        <HeroRouter />
      </section>

      {/* Networks */}
      <section className="border-y border-line bg-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-5 flex flex-wrap items-center gap-x-8 gap-y-3">
          <span className="text-sm font-semibold text-ink-500">One account. Every network.</span>
          {NETWORKS.map((n) => <span key={n} className="text-[17px] font-extrabold tracking-tight text-ink-700">{n}</span>)}
        </div>
      </section>

      {/* Platform */}
      <section id="platform" className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
          <div>
            <p className={cx(EYEBROW, 'text-ink-500')}>The platform</p>
            <h2 className={cx(H2, 'mt-3 max-w-[18ch]')}>One contact list. One API. Every way people talk.</h2>
          </div>
          <p className="text-ink-500 max-w-[44ch] leading-relaxed">Add a channel without changing your contacts, your code or your bill. Each message is logged in one place with its delivery status and cost.</p>
        </div>
        <div className="mt-12 grid sm:grid-cols-2 lg:grid-cols-3 gap-px bg-line rounded-3xl overflow-hidden border border-line">
          {CHANNELS.map(({ icon: Icon, name, status, line, detail }) => (
            <div key={name} className="bg-white p-6 sm:p-7 flex flex-col">
              <div className="flex items-center justify-between">
                <span className={cx('grid h-11 w-11 place-items-center rounded-xl', status === 'live' ? 'bg-brand text-white' : 'bg-brand-50 text-brand')}><Icon className="h-5 w-5" /></span>
                <StatusPill status={status} />
              </div>
              <h3 className="mt-5 text-xl font-bold tracking-tight">{name}</h3>
              <p className="mt-1.5 text-ink-500 leading-relaxed">{line}</p>
              <p className="mt-auto pt-4 text-[13px] text-ink-400">{detail}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Intelligence */}
      <section id="intelligence" className="bg-brand-900 text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="grid lg:grid-cols-[1fr_1.15fr] gap-12 items-start">
            <div className="min-w-0">
              <p className={cx(EYEBROW, 'text-amber')}>Bermi Intelligence · early access</p>
              <h2 className={cx(H2, 'mt-3')}>The part that thinks before it sends.</h2>
              <p className="mt-5 text-lg text-white/70 leading-relaxed max-w-[44ch]">
                Most platforms deliver whatever you type. Bermi Intelligence helps you say it well, in the right language, on the channel each person actually uses, and makes sense of what comes back.
              </p>
              <ul className="mt-10 grid gap-6 sm:grid-cols-2">
                {AI.map(({ icon: Icon, title, body }) => (
                  <li key={title} className="min-w-0">
                    <Icon className="h-5 w-5 text-amber" />
                    <h3 className="mt-3 text-lg font-bold">{title}</h3>
                    <p className="mt-1 text-[15px] text-white/65 leading-relaxed">{body}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="min-w-0 rounded-3xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
              <div className="text-sm font-semibold text-white/80">Same notice, written two ways</div>
              <div className="mt-4"><AiExample /></div>
            </div>
          </div>
        </div>
      </section>

      {/* Who */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
        <h2 className={cx(H2, 'max-w-[22ch]')}>For anyone who needs to reach a lot of people, reliably.</h2>
        <div className="mt-10 grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {AUDIENCES.map(({ icon: Icon, title, body }) => (
            <div key={title}>
              <Icon className="h-6 w-6 text-brand" strokeWidth={1.8} />
              <h3 className="mt-4 text-lg font-bold">{title}</h3>
              <p className="mt-1.5 text-ink-500 leading-relaxed">{body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="bg-brand-50 border-y border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20">
          <div className="grid lg:grid-cols-[1fr_auto] gap-6 items-end mb-10">
            <div>
              <p className={cx(EYEBROW, 'text-brand')}>Pricing</p>
              <h2 className={cx(H2, 'mt-3')}>TZS {PRICE_TZS} per SMS. Nothing else to decode.</h2>
              <p className="mt-3 text-lg text-ink-500 max-w-[54ch]">No monthly fee and no bundles. Top up any amount, pay only for what you send, and get failed messages refunded automatically.</p>
            </div>
            <ul className="space-y-2 text-[15px]">
              {['Verification codes billed as SMS', 'WhatsApp, voice and USSD: pricing with early access', 'Volume rates from 100,000 SMS a month'].map((t) => (
                <li key={t} className="flex gap-2"><CheckCheck className="h-4 w-4 mt-1 text-ok shrink-0" />{t}</li>
              ))}
            </ul>
          </div>
          <CostPlayground />
        </div>
      </section>

      {/* Developers */}
      <section id="developers" className="bg-ink text-white">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-20 grid lg:grid-cols-2 gap-12 items-center">
          <div className="min-w-0">
            <p className={cx(EYEBROW, 'text-amber')}>Developers</p>
            <h2 className={cx(H2, 'mt-3')}>Your first SMS from code in five minutes.</h2>
            <p className="mt-4 text-lg text-white/70 leading-relaxed max-w-[46ch]">
              One endpoint, predictable JSON, signed delivery webhooks and test keys that simulate delivery without spending money. New channels arrive on the same API.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/register" className="btn btn-lg btn-accent">Get an API key</Link>
              <a href={DOCS_URL} className="btn btn-lg border border-white/20 text-white hover:bg-white/10">Read the docs</a>
            </div>
          </div>
          <div className="min-w-0 rounded-2xl bg-[#08071C] border border-white/10 overflow-hidden">
            <div className="flex items-center gap-2 px-4 h-10 border-b border-white/10 text-[13px] text-white/50">
              <span className="h-2.5 w-2.5 rounded-full bg-white/15" /><span className="h-2.5 w-2.5 rounded-full bg-white/15" /><span className="h-2.5 w-2.5 rounded-full bg-white/15" />
              <span className="ml-2">send.sh</span>
            </div>
            <pre className="p-5 text-[13px] leading-relaxed font-mono overflow-x-auto text-[#d6d5f2]"><code>{CODE}</code></pre>
            <div className="px-5 pb-5 font-mono text-[13px] text-amber/90 overflow-x-auto">→ 202 {`{ "data": { "batch_id": "…", "total_cost_tzs": ${PRICE_TZS * 2} } }`}</div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="max-w-6xl mx-auto px-4 sm:px-6 py-20 text-center">
        <LogoMark className="h-12 w-14 mx-auto" />
        <h2 className="mt-6 text-[34px] sm:text-[52px] font-black tracking-[-0.04em] leading-tight [text-wrap:balance]">Ongea na kila mtu, kwa njia anayoielewa.</h2>
        <p className="mt-3 text-lg text-ink-500">Talk to everyone, in the way they understand. Start with SMS today.</p>
        <Link to="/register" className="btn btn-lg btn-primary mt-8">Create free account <ArrowRight className="h-5 w-5" /></Link>
      </section>

      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 flex flex-col sm:flex-row justify-between gap-4 text-sm text-ink-500">
          <div><Logo /><p className="mt-2">Communication Intelligence, a branch of Bermi Techs.</p></div>
          <div className="flex flex-wrap gap-5 items-center">
            <a href={DOCS_URL} className="hover:text-ink">API docs</a>
            <Link to="/login" className="hover:text-ink">Log in</Link>
            <span>© {new Date().getFullYear()} Bermi Techs, Dar es Salaam</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
