import { FormEvent, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { GraduationCap, Store, Code2, Building2 } from 'lucide-react';
import { Logo } from '../components/Logo';
import { Button, Field, Input, cx } from '../components/ui';
import { api, errMsg } from '../lib/api';
import { useAuth } from '../lib/auth';
import type { AccountType, AuthResult } from '../lib/types';
import { normalisePhone } from '../lib/sms';

function Shell({ children, side }: { children: React.ReactNode; side: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-[1fr_minmax(0,560px)]">
      <div className="hidden lg:flex flex-col bg-ink text-white p-12">
        <Link to="/"><Logo dark /></Link>
        <div className="my-auto max-w-md">{side}</div>
        <p className="text-sm text-white/40">Bermi Techs · Dar es Salaam</p>
      </div>
      <div className="flex flex-col px-5 sm:px-10 py-8">
        <Link to="/" className="lg:hidden mb-10"><Logo /></Link>
        <div className="w-full max-w-[420px] mx-auto my-auto">{children}</div>
      </div>
    </div>
  );
}

function SideQuote() {
  return (
    <>
      <div className="bubble-out max-w-sm text-lg">Habari! Report cards are ready for collection on Friday. 📚</div>
      <div className="mt-3 bubble max-w-[16rem] ml-auto text-lg">Asante sana, tutafika 🙏</div>
      <p className="mt-10 text-3xl font-extrabold tracking-tight leading-tight">Reach everyone. Instantly.</p>
      <p className="mt-3 text-white/60 text-lg">Bulk SMS for schools, businesses and developers across Tanzania.</p>
    </>
  );
}

export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const nav = useNavigate();
  const [sp] = useSearchParams();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!email || !password) { setError('Enter your email and password.'); return; }
    setBusy(true); setError(null);
    try {
      const r = await api.post<AuthResult>('/auth/login', { email: email.trim(), password });
      signIn(r);
      nav(sp.get('next') || '/app', { replace: true });
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  return (
    <Shell side={<SideQuote />}>
      <h1 className="text-[32px] font-black tracking-[-0.03em]">Karibu tena</h1>
      <p className="mt-1 text-ink-500">Log in to send messages.</p>
      {sp.get('expired') && <div className="mt-5 rounded-xl bg-amber-50 border border-amber/40 p-3 text-sm">Your session ended. Please log in again.</div>}
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <Field label="Email" htmlFor="email"><Input id="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@school.ac.tz" /></Field>
        <Field label="Password" htmlFor="pw"><Input id="pw" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        {error && <p className="err" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Log in</Button>
      </form>
      <button type="button" onClick={() => { setEmail('demo@bermiconnect.co.tz'); setPassword('demo1234'); }} className="mt-4 w-full text-sm text-ink-500 hover:text-ink">
        Just looking? <span className="font-semibold text-brand">Fill in the demo account</span>
      </button>
      <p className="mt-8 text-center text-[15px] text-ink-500">New here? <Link to="/register" className="font-semibold text-brand">Create a free account</Link></p>
    </Shell>
  );
}

const TYPES: { value: AccountType; label: string; desc: string; icon: typeof Store }[] = [
  { value: 'school', label: 'School', desc: 'Parents & staff', icon: GraduationCap },
  { value: 'business', label: 'Business', desc: 'Customers', icon: Store },
  { value: 'developer', label: 'Developer', desc: 'API & OTP', icon: Code2 },
  { value: 'other', label: 'Other', desc: 'NGO, church, group', icon: Building2 },
];

export function Register() {
  const [f, setF] = useState({ name: '', email: '', password: '', account_name: '', account_type: 'school' as AccountType, phone: '' });
  const [errs, setErrs] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const { signIn } = useAuth();
  const nav = useNavigate();
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value });

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const er: Record<string, string> = {};
    if (!f.account_name.trim()) er.account_name = f.account_type === 'school' ? 'Enter your school’s name.' : 'Enter your organisation’s name.';
    if (!f.name.trim()) er.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(f.email)) er.email = 'Enter a valid email address.';
    const phone = normalisePhone(f.phone);
    if (!phone) er.phone = 'Enter a phone number like 0754 123 456.';
    if (f.password.length < 8) er.password = 'Use at least 8 characters.';
    setErrs(er);
    if (Object.keys(er).length) return;
    setBusy(true); setError(null);
    try {
      const r = await api.post<AuthResult>('/auth/register', { ...f, email: f.email.trim(), phone });
      signIn(r);
      nav('/app', { replace: true });
    } catch (err) { setError(errMsg(err)); } finally { setBusy(false); }
  };

  const orgLabel = f.account_type === 'school' ? 'School name' : f.account_type === 'developer' ? 'Company or app name' : 'Organisation name';

  return (
    <Shell side={<SideQuote />}>
      <h1 className="text-[32px] font-black tracking-[-0.03em]">Create your account</h1>
      <p className="mt-1 text-ink-500">Free to start. TZS 500 credit included.</p>
      <form onSubmit={submit} className="mt-8 space-y-5" noValidate>
        <fieldset>
          <legend className="field-label">Who are you sending for?</legend>
          <div className="grid grid-cols-2 gap-2.5">
            {TYPES.map(({ value, label, desc, icon: Icon }) => {
              const on = f.account_type === value;
              return (
                <button type="button" key={value} onClick={() => setF({ ...f, account_type: value })} aria-pressed={on}
                  className={cx('text-left rounded-2xl border-2 p-3.5 transition-colors', on ? 'border-brand bg-brand-50' : 'border-line bg-white hover:border-ink-300')}>
                  <Icon className={cx('h-6 w-6', on ? 'text-brand' : 'text-ink-400')} />
                  <div className="mt-2 font-bold">{label}</div>
                  <div className="text-[13px] text-ink-500">{desc}</div>
                </button>
              );
            })}
          </div>
        </fieldset>
        <Field label={orgLabel} error={errs.account_name} htmlFor="org"><Input id="org" value={f.account_name} onChange={set('account_name')} invalid={!!errs.account_name} placeholder={f.account_type === 'school' ? 'e.g. Mlimani Secondary School' : ''} /></Field>
        <Field label="Your name" error={errs.name} htmlFor="nm"><Input id="nm" autoComplete="name" value={f.name} onChange={set('name')} invalid={!!errs.name} /></Field>
        <Field label="Phone" error={errs.phone} htmlFor="ph"><Input id="ph" type="tel" inputMode="tel" autoComplete="tel" value={f.phone} onChange={set('phone')} invalid={!!errs.phone} placeholder="0754 123 456" /></Field>
        <Field label="Email" error={errs.email} htmlFor="em"><Input id="em" type="email" autoComplete="email" value={f.email} onChange={set('email')} invalid={!!errs.email} /></Field>
        <Field label="Password" error={errs.password} hint="At least 8 characters." htmlFor="pw"><Input id="pw" type="password" autoComplete="new-password" value={f.password} onChange={set('password')} invalid={!!errs.password} /></Field>
        {error && <p className="err" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="w-full" loading={busy}>Create account</Button>
      </form>
      <p className="mt-8 text-center text-[15px] text-ink-500">Already have an account? <Link to="/login" className="font-semibold text-brand">Log in</Link></p>
    </Shell>
  );
}
