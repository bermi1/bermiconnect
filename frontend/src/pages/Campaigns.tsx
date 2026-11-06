import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { Megaphone, Plus, ChevronRight } from 'lucide-react';
import { api } from '../lib/api';
import type { Campaign, CampaignStatus } from '../lib/types';
import { Empty, ErrorBox, PageHeader, Pager, StatusBadge, TableSkeleton, cx } from '../components/ui';
import { dateTime, int, num, tzs } from '../lib/format';

const FILTERS: { v: '' | CampaignStatus; l: string }[] = [
  { v: '', l: 'All' }, { v: 'sending', l: 'Sending' }, { v: 'scheduled', l: 'Scheduled' }, { v: 'completed', l: 'Completed' }, { v: 'draft', l: 'Drafts' },
];

export function Progress({ c }: { c: Campaign }) {
  const total = Math.max(num(c.total_recipients), 1);
  const dc = num(c.delivered_count); const fc = num(c.failed_count);
  const d = (dc / total) * 100; const f = (fc / total) * 100;
  const s = Math.max(((num(c.sent_count) - dc - fc) / total) * 100, 0);
  return (
    <div className="h-2 w-full rounded-full bg-ink/[0.07] overflow-hidden flex gap-[2px]" aria-label={`${c.delivered_count} delivered, ${c.failed_count} failed of ${c.total_recipients}`}>
      {d > 0 && <div className="bg-ok h-full rounded-full" style={{ width: `${d}%` }} />}
      {s > 0 && <div className="bg-sky-500 h-full rounded-full" style={{ width: `${s}%` }} />}
      {f > 0 && <div className="bg-bad h-full rounded-full" style={{ width: `${f}%` }} />}
    </div>
  );
}

export default function Campaigns({ embedded }: { embedded?: boolean } = {}) {
  const [status, setStatus] = useState<'' | CampaignStatus>('');
  const [page, setPage] = useState(1);
  const q = useQuery({
    queryKey: ['campaigns', status, page],
    queryFn: () => api.page<Campaign[]>('/campaigns', { status, page, per_page: 20 }),
    refetchInterval: (query) => (query.state.data?.data?.some((c) => c.status === 'sending') ? 4000 : false),
  });
  const list = q.data?.data || [];

  return (
    <div className="animate-rise">
      {!embedded && <PageHeader title="Sends" subtitle="Campaigns and Excel sends."
        actions={<Link to="/app/send" className="btn btn-md btn-primary"><Plus className="h-4 w-4" />Send SMS</Link>} />}
      <div className="flex gap-2 overflow-x-auto scrollbar-none mb-4 -mx-4 px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((f) => (
          <button key={f.l} onClick={() => { setStatus(f.v); setPage(1); }}
            className={cx('h-9 px-4 rounded-full text-sm font-semibold whitespace-nowrap border', status === f.v ? 'bg-ink text-white border-ink' : 'bg-white border-line text-ink-700')}>{f.l}</button>
        ))}
      </div>
      <div className="panel overflow-hidden">
        {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !list.length ? (
          <Empty icon={<Megaphone className="h-6 w-6" />} title={status ? 'Nothing here' : 'Nothing sent yet'}
            body="Send to a group or from an Excel sheet and the delivery report shows up here."
            action={<Link to="/app/send" className="btn btn-md btn-primary">Send SMS</Link>} />
        ) : (
          <ul className="divide-y divide-line">
            {list.map((c) => (
              <li key={c.id}>
                <Link to={`/app/campaigns/${c.id}`} className="grid grid-cols-[1fr_auto] md:grid-cols-[1.6fr_1fr_120px_110px_20px] gap-x-6 gap-y-2 items-center px-5 py-4 hover:bg-paper/70">
                  <div className="min-w-0">
                    <div className="font-semibold truncate">{c.name}</div>
                    <div className="text-[13px] text-ink-500 truncate">{c.status === 'scheduled' ? `Goes out ${dateTime(c.scheduled_at)}` : dateTime(c.started_at || c.created_at)} · {c.source === 'file' ? 'from Excel' : `from ${c.sender_id}`}</div>
                  </div>
                  <div className="md:order-none order-3 col-span-2 md:col-span-1">
                    <Progress c={c} />
                    <div className="mt-1 text-[12px] text-ink-500 tabular-nums">{int(c.delivered_count)} of {int(c.total_recipients)} delivered</div>
                  </div>
                  <div className="hidden md:block text-sm tabular-nums text-ink-700">{tzs(c.cost_tzs)}</div>
                  <div className="justify-self-end md:justify-self-start"><StatusBadge status={c.status} /></div>
                  <ChevronRight className="h-4 w-4 text-ink-300 hidden md:block" />
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Pager page={page} perPage={20} total={q.data?.meta?.total} onPage={setPage} />
      </div>
    </div>
  );
}
