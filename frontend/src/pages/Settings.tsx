import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { Button, Field, Input, PageHeader } from '../components/ui';
import { useToast } from '../components/Toast';
import { api, errMsg } from '../lib/api';
import { dateOnly } from '../lib/format';

const TYPE_LABEL = { school: 'School', business: 'Business', developer: 'Developer', other: 'Other' };

export default function Settings() {
  const { user, account, signOut, refresh } = useAuth();
  const toast = useToast();
  const [name, setName] = useState(user?.name || '');
  const [busy, setBusy] = useState(false);
  const save = async () => {
    setBusy(true);
    try { await api.patch('/me', { name }); await refresh(); toast.success('Profile saved.'); }
    catch (e) { toast.error(errMsg(e)); } finally { setBusy(false); }
  };
  return (
    <div className="animate-rise max-w-2xl">
      <PageHeader title="Settings" />
      <section className="panel p-5 sm:p-6">
        <h2 className="font-bold text-lg mb-4">Your profile</h2>
        <div className="space-y-4">
          <Field label="Name"><Input value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Email" hint="Contact support to change your email."><Input value={user?.email || ''} disabled /></Field>
          <Field label="Role"><Input value={user?.role || ''} disabled className="capitalize" /></Field>
          <Button onClick={save} loading={busy} disabled={!name.trim() || name === user?.name}>Save profile</Button>
        </div>
      </section>
      <section className="panel p-5 sm:p-6 mt-4">
        <h2 className="font-bold text-lg mb-4">Account</h2>
        <dl className="grid grid-cols-2 gap-4 text-[15px]">
          <div><dt className="text-ink-500 text-sm">Organisation</dt><dd className="font-semibold">{account?.name}</dd></div>
          <div><dt className="text-ink-500 text-sm">Type</dt><dd className="font-semibold">{account ? TYPE_LABEL[account.type] : ''}</dd></div>
          <div><dt className="text-ink-500 text-sm">Phone</dt><dd className="font-semibold tabular-nums">{account?.phone || '—'}</dd></div>
          <div><dt className="text-ink-500 text-sm">Member since</dt><dd className="font-semibold">{dateOnly(account?.created_at)}</dd></div>
        </dl>
      </section>
      <section className="panel p-5 sm:p-6 mt-4 flex items-center justify-between gap-4">
        <div><h2 className="font-bold">Log out</h2><p className="text-sm text-ink-500">Sign out of Bermi Connect on this device.</p></div>
        <Button variant="outline" onClick={signOut}>Log out</Button>
      </section>
      <p className="mt-6 text-sm text-ink-500">Need help? Contact Bermi Techs support from the <a href="/docs" className="text-brand font-semibold">help pages</a>.</p>
    </div>
  );
}
