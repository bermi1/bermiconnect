import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Send, Megaphone, UserPlus, Wallet, ChevronRight } from 'lucide-react';
import { useAuth } from '../lib/auth';
import { useStats } from '../lib/hooks';
import { api } from '../lib/api';
import type { Campaign } from '../lib/types';
import { greeting, int, pct, tzs, dateTime } from '../lib/format';
import { PRICE_TZS } from '../lib/sms';
import { Empty, ErrorBox, Skeleton, StatusBadge } from '../components/ui';
import DeliveryChart from '../components/DeliveryChart';

export default function Dashboard() {
  const { user, account } = useAuth();
  const stats = useStats();
  const recent = useQuery({ queryKey: ['campaigns', 'recent'], queryFn: () => api.get<Campaign[]>('/campaigns', { per_page: 5 }) });
  const s = stats.data;
  const first = (user?.name || '').split(' ')[0];
  const isSchool = account?.type === 'school';

  return (
    <div className="animate-rise">
      <div className="mb-7">
        <p className="text-ink-500 text-[15px]">{greeting()}{first ? `, ${first}` : ''}</p>
        <h1 className="text-[28px] sm:text-[34px] font-extrabold tracking-[-0.025em] leading-tight">What would you like to send today?</h1>
      </div>

      {/* Big actions */}
      <div className="grid grid-cols-3 lg:grid-cols-4 gap-2.5 sm:gap-3 mb-8">
        <Link to="/app/send" className="col-span-3 lg:col-span-1 rounded-2xl bg-brand text-white p-5 flex items-center gap-4 hover:bg-brand-700 transition-colors">
          <span className="h-12 w-12 rounded-xl bg-white/15 grid place-items-center"><Send className="h-6 w-6" /></span>
          <span><span className="block text-lg font-bold">Tuma SMS</span><span className="text-white/75 text-sm">Send to a few numbers</span></span>
        </Link>
        {[
          { to: '/app/campaigns/new', icon: Megaphone, t: 'New campaign', d: isSchool ? 'Message a whole class' : 'Message a whole group' },
          { to: '/app/contacts', icon: UserPlus, t: 'Add contacts', d: 'Type or import Excel' },
          { to: '/app/wallet', icon: Wallet, t: 'Top up', d: 'M-Pesa, Tigo, Airtel' },
        ].map(({ to, icon: Icon, t, d }) => (
          <Link key={to} to={to} className="rounded-2xl bg-white border border-line p-3 sm:p-5 flex flex-col items-center text-center sm:text-left sm:flex-row sm:items-center gap-2 sm:gap-3 hover:border-brand/40 transition-colors">
            <span className="h-11 w-11 rounded-xl bg-brand-50 text-brand grid place-items-center shrink-0"><Icon className="h-5 w-5" /></span>
            <span><span className="block font-bold text-[14px] sm:text-base leading-tight">{t}</span><span className="hidden sm:block text-ink-500 text-[13px]">{d}</span></span>
          </Link>
        ))}
      </div>

      {stats.isError ? <ErrorBox error={stats.error} onRetry={() => stats.refetch()} /> : (
        <div className="grid lg:grid-cols-[1fr_320px] gap-5">
          <section className="panel p-5 sm:p-6">
            <div className="flex flex-wrap items-end justify-between gap-4 mb-5">
              <div>
                <h2 className="font-bold text-lg">Last 14 days</h2>
                <p className="text-sm text-ink-500">Messages sent per day</p>
              </div>
              <div className="flex gap-6">
                <Stat label="Sent today" value={s ? int(s.sent_today) : null} />
                <Stat label="Last 30 days" value={s ? int(s.sent_30d) : null} />
                <Stat label="Delivered" value={s ? pct(Number(s.delivered_rate) || 0) : null} />
              </div>
            </div>
            {s ? <DeliveryChart daily={s.daily || []} /> : <Skeleton className="h-[260px] w-full" />}
          </section>

          <div className="flex flex-col gap-5">
            <Link to="/app/wallet" className="rounded-2xl bg-ink text-white p-5 sm:p-6 block hover:bg-ink-700 transition-colors">
              <div className="text-white/60 text-sm">Wallet balance</div>
              {s ? <div className="mt-1 text-[34px] font-black tabular-nums tracking-tight leading-none">{tzs(s.balance_tzs)}</div> : <Skeleton className="h-9 w-40 mt-1 bg-white/10" />}
              <div className="mt-3 text-sm text-white/60">{s ? `≈ ${int(Math.floor(Number(s.balance_tzs) / (Number(s.price_per_sms_tzs) || PRICE_TZS)))} SMS left` : ' '}</div>
              <div className="mt-4 inline-flex items-center gap-1 text-amber font-semibold text-sm">Top up <ChevronRight className="h-4 w-4" /></div>
            </Link>
            <div className="grid grid-cols-2 gap-3">
              <div className="panel p-4"><div className="text-[13px] text-ink-500">Contacts</div><div className="text-2xl font-extrabold tabular-nums">{s ? int(s.contacts_total) : '—'}</div></div>
              <div className="panel p-4"><div className="text-[13px] text-ink-500">Active campaigns</div><div className="text-2xl font-extrabold tabular-nums">{s ? int(s.campaigns_active) : '—'}</div></div>
            </div>
          </div>
        </div>
      )}

      <section className="panel mt-5">
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-line">
          <h2 className="font-bold text-lg">Recent campaigns</h2>
          <Link to="/app/campaigns" className="text-sm font-semibold text-brand">See all</Link>
        </div>
        {recent.isLoading ? <div className="p-5 space-y-3">{[0, 1, 2].map((i) => <Skeleton key={i} className="h-12" />)}</div>
          : !recent.data?.length ? (
            <Empty icon={<Megaphone className="h-6 w-6" />} title="No campaigns yet" body="A campaign sends one message to a whole group, like all Form 4 parents."
              action={<Link to="/app/campaigns/new" className="btn btn-md btn-primary">Create your first campaign</Link>} />
          ) : (
            <ul className="divide-y divide-line">
              {recent.data.map((c) => (
                <li key={c.id}>
                  <Link to={`/app/campaigns/${c.id}`} className="flex items-center gap-4 px-5 sm:px-6 py-3.5 hover:bg-paper/70">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate">{c.name}</div>
                      <div className="text-[13px] text-ink-500">{int(c.total_recipients)} recipients · {dateTime(c.scheduled_at || c.created_at)}</div>
                    </div>
                    <StatusBadge status={c.status} />
                    <ChevronRight className="h-4 w-4 text-ink-300 hidden sm:block" />
                  </Link>
                </li>
              ))}
            </ul>
          )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <div className="text-[12px] text-ink-500">{label}</div>
      {value === null ? <Skeleton className="h-6 w-14 mt-1" /> : <div className="text-xl font-extrabold tabular-nums">{value}</div>}
    </div>
  );
}
