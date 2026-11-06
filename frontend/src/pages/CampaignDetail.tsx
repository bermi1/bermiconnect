import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ChevronLeft, Download, Send, XCircle, Trash2, Search } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { Campaign, Message, MessageStatus } from '../lib/types';
import { Button, Empty, ErrorBox, Input, Modal, Pager, Skeleton, StatusBadge, TableSkeleton, cx } from '../components/ui';
import { useToast } from '../components/Toast';
import { dateTime, downloadCsv, int, num, tzs } from '../lib/format';
import { useGroups } from '../lib/hooks';

export default function CampaignDetail() {
  const { id } = useParams();
  const qc = useQueryClient();
  const toast = useToast();
  const nav = useNavigate();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState<'' | MessageStatus>('');
  const [q, setQ] = useState('');
  const [confirm, setConfirm] = useState<'cancel' | 'delete' | null>(null);
  const [exporting, setExporting] = useState(false);
  const groups = useGroups();

  const c = useQuery({
    queryKey: ['campaign', id], queryFn: () => api.get<Campaign>(`/campaigns/${id}`),
    refetchInterval: (query) => (query.state.data?.status === 'sending' ? 3000 : false),
  });
  const live = c.data?.status === 'sending';
  const msgs = useQuery({
    queryKey: ['campaign-msgs', id, page, status],
    queryFn: () => api.page<Message[]>(`/campaigns/${id}/messages`, { page, per_page: 50, status }),
    refetchInterval: live ? 4000 : false,
  });

  const act = useMutation({
    mutationFn: (a: 'send' | 'cancel' | 'delete') => a === 'delete' ? api.del(`/campaigns/${id}`) : api.post(`/campaigns/${id}/${a}`, {}),
    onSuccess: (_, a) => {
      qc.invalidateQueries({ queryKey: ['campaigns'] }); qc.invalidateQueries({ queryKey: ['balance'] });
      setConfirm(null);
      if (a === 'delete') { toast.success('Campaign deleted.'); nav('/app/reports'); return; }
      toast.success(a === 'send' ? 'Campaign is sending.' : 'Campaign cancelled.');
      qc.invalidateQueries({ queryKey: ['campaign', id] });
    },
    onError: (e) => toast.error(errMsg(e)),
  });

  const exportCsv = async () => {
    setExporting(true);
    try {
      const all: Message[] = [];
      for (let p = 1; p < 200; p++) {
        const r = await api.page<Message[]>(`/campaigns/${id}/messages`, { page: p, per_page: 200 });
        all.push(...(r.data || []));
        if (!r.data?.length || (r.meta && all.length >= r.meta.total) || r.data.length < 200) break;
      }
      const isFile = c.data?.source === 'file';
      if (isFile) all.sort((a, b) => Number(a.row_ref) - Number(b.row_ref) || String(a.row_ref).localeCompare(String(b.row_ref)));
      downloadCsv(`${(c.data?.name || 'campaign').replace(/[^\w-]+/g, '_')}_report.csv`, [
        [...(isFile ? ['excel_row'] : []), 'phone', 'status', 'segments', 'cost_tzs', 'error_code', 'sent_at', 'delivered_at', 'message'],
        ...all.map((m) => [...(isFile ? [m.row_ref] : []), m.to_phone, m.status, m.segments, m.cost_tzs, m.error_code, m.sent_at, m.delivered_at, m.body]),
      ]);
      toast.success(`Downloaded ${all.length} rows.`);
    } catch (e) { toast.error(errMsg(e)); } finally { setExporting(false); }
  };

  if (c.isError) return <ErrorBox error={c.error} onRetry={() => c.refetch()} />;
  const raw = c.data && !Array.isArray(c.data) ? c.data : undefined;
  const d = raw ? { ...raw, total_recipients: num(raw.total_recipients), sent_count: num(raw.sent_count), delivered_count: num(raw.delivered_count), failed_count: num(raw.failed_count), group_ids: raw.group_ids || [] } : undefined;
  const total = Math.max(d?.total_recipients || 0, 1);
  const pending = d ? Math.max(d.total_recipients - d.delivered_count - d.failed_count, 0) : 0;
  const rows = (msgs.data?.data || []).filter((m) => !q || m.to_phone.includes(q.replace(/\s/g, '')) || m.row_ref === q.trim());

  return (
    <div className="animate-rise">
      <Link to="/app/reports" className="inline-flex items-center gap-1 text-sm font-semibold text-ink-500 hover:text-ink mb-3"><ChevronLeft className="h-4 w-4" />Reports</Link>
      {!d ? <Skeleton className="h-10 w-72 mb-6" /> : (
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-6">
          <div>
            <div className="flex items-center gap-3 flex-wrap">
              <h1 className="text-[26px] sm:text-[30px] font-extrabold tracking-tight">{d.name}</h1>
              <StatusBadge status={d.status} />
            </div>
            <p className="text-ink-500 mt-1 text-[15px]">
              From {d.sender_id} · {d.source === 'file' ? 'Sent from Excel' : (groups.data || []).filter((g) => d.group_ids?.includes(g.id)).map((g) => g.name).join(', ') || `${d.group_ids?.length || 0} groups`}
              {d.status === 'scheduled' && <> · goes out {dateTime(d.scheduled_at)}</>}
            </p>
          </div>
          <div className="flex gap-2 flex-wrap">
            {(d.status === 'draft') && <Button icon={<Send className="h-4 w-4" />} onClick={() => act.mutate('send')} loading={act.isPending}>Tuma sasa</Button>}
            {(d.status === 'scheduled' || d.status === 'sending') && <Button variant="outline" icon={<XCircle className="h-4 w-4" />} onClick={() => setConfirm('cancel')}>Cancel</Button>}
            {d.status !== 'draft' && <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={exportCsv} loading={exporting}>Download report</Button>}
            {(d.status === 'draft' || d.status === 'cancelled') && <Button variant="ghost" icon={<Trash2 className="h-4 w-4" />} onClick={() => setConfirm('delete')}>Delete</Button>}
          </div>
        </div>
      )}

      {d && (
        <div className="grid lg:grid-cols-[1fr_340px] gap-5 mb-5">
          <section className="panel p-5 sm:p-6">
            <div className="flex items-baseline justify-between">
              <h2 className="font-bold text-lg">Delivery</h2>
              {live && <span className="text-[13px] text-sky-700 font-semibold flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-sky-500 animate-pulse" />Updating live</span>}
            </div>
            <div className="mt-4 text-[44px] font-black tabular-nums leading-none tracking-tight">
              {Math.round((d.delivered_count / total) * 100)}%<span className="text-lg font-semibold text-ink-500 ml-2 tracking-normal">delivered</span>
            </div>
            <div className="mt-5 space-y-3.5">
              <Bar label="Sent to network" value={d.sent_count} total={total} color="bg-ink-700" />
              <Bar label="Delivered" value={d.delivered_count} total={total} color="bg-ok" />
              <Bar label="Failed (refunded)" value={d.failed_count} total={total} color="bg-bad" />
              <Bar label="Waiting" value={pending} total={total} color="bg-ink-300" />
            </div>
          </section>
          <section className="panel p-5 sm:p-6 flex flex-col">
            <div className="grid grid-cols-2 gap-4">
              <div><div className="text-[13px] text-ink-500">Recipients</div><div className="text-2xl font-extrabold tabular-nums">{int(d.total_recipients)}</div></div>
              <div><div className="text-[13px] text-ink-500">Cost</div><div className="text-2xl font-extrabold tabular-nums">{tzs(d.cost_tzs)}</div></div>
            </div>
            <div className="mt-5 text-[13px] text-ink-500 mb-2">Message</div>
            <div className="bubble-out text-[14px] whitespace-pre-wrap break-words">{d.template || d.body}</div>
            {d.source === 'file' && <p className="mt-2 text-[12px] text-ink-500">Each row got its own version of this message.</p>}
          </section>
        </div>
      )}

      <section className="panel overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-line">
          <h2 className="font-bold text-lg">Delivery report</h2>
          <div className="flex gap-2">
            <div className="relative flex-1 sm:w-52">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-400" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={d?.source === 'file' ? 'Find a number or row' : 'Find a number'} className="h-10 pl-9 text-sm" />
            </div>
            <select value={status} onChange={(e) => { setStatus(e.target.value as MessageStatus | ''); setPage(1); }} className="input h-10 w-auto text-sm">
              <option value="">All</option><option value="delivered">Delivered</option><option value="failed">Failed</option><option value="sent">Sent</option><option value="queued">Queued</option>
            </select>
          </div>
        </div>
        {msgs.isLoading ? <TableSkeleton /> : msgs.isError ? <ErrorBox error={msgs.error} onRetry={() => msgs.refetch()} /> : !rows.length ? (
          <Empty icon={<Send className="h-6 w-6" />} title={d?.status === 'draft' || d?.status === 'scheduled' ? 'Not sent yet' : 'No messages match'} body={d?.status === 'draft' ? 'Messages show here once the campaign is sent.' : undefined} />
        ) : (
          <div className="overflow-x-auto">
            <table className="table-base min-w-[640px]">
              <thead><tr>{d?.source === 'file' && <th>Row</th>}<th>Phone</th><th>Status</th><th>Parts</th><th>Cost</th><th>Sent</th><th>Delivered</th></tr></thead>
              <tbody>
                {rows.map((m) => (
                  <tr key={m.id}>
                    {d?.source === 'file' && <td className="tabular-nums text-ink-500">{m.row_ref}</td>}
                    <td className="font-medium tabular-nums">{m.to_phone}</td>
                    <td><StatusBadge status={m.status} />{m.error_code && <span className="ml-2 text-[12px] text-ink-400">{m.error_code}</span>}</td>
                    <td className="tabular-nums">{m.segments}</td>
                    <td className="tabular-nums">{tzs(m.cost_tzs)}</td>
                    <td className="text-ink-500">{dateTime(m.sent_at)}</td>
                    <td className="text-ink-500">{dateTime(m.delivered_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <Pager page={page} perPage={50} total={msgs.data?.meta?.total} onPage={setPage} />
      </section>

      <Modal open={!!confirm} onClose={() => setConfirm(null)} title={confirm === 'delete' ? 'Delete this campaign?' : 'Cancel this campaign?'}
        footer={<><Button variant="ghost" onClick={() => setConfirm(null)}>Keep it</Button><Button variant="danger" loading={act.isPending} onClick={() => confirm && act.mutate(confirm)}>{confirm === 'delete' ? 'Delete campaign' : 'Cancel campaign'}</Button></>}>
        <p className="text-ink-500">{confirm === 'delete' ? 'This removes the campaign. Messages already sent are not affected.' : 'Messages not yet sent will be stopped and their cost refunded.'}</p>
      </Modal>
    </div>
  );
}

function Bar({ label, value, total, color }: { label: string; value: number; total: number; color: string }) {
  const p = Math.min((value / total) * 100, 100);
  return (
    <div>
      <div className="flex justify-between text-[13px] mb-1.5"><span className="text-ink-700 font-medium">{label}</span><span className="tabular-nums font-semibold">{int(value)}</span></div>
      <div className="h-2.5 rounded-full bg-ink/[0.06] overflow-hidden"><div className={cx('h-full rounded-full transition-[width] duration-700', color)} style={{ width: `${p}%` }} /></div>
    </div>
  );
}
