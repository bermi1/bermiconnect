import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessagesSquare, Download } from 'lucide-react';
import { api } from '../lib/api';
import type { Message, MessageStatus } from '../lib/types';
import { Button, Empty, ErrorBox, Input, Modal, PageHeader, Pager, Select, StatusBadge, TableSkeleton } from '../components/ui';
import { dateTime, downloadCsv, tzs } from '../lib/format';

export default function Messages({ embedded }: { embedded?: boolean } = {}) {
  const [status, setStatus] = useState<'' | MessageStatus>('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState<Message | null>(null);
  const query = { status, from: from ? new Date(from).toISOString() : '', to: to ? new Date(to + 'T23:59:59').toISOString() : '', page, per_page: 50 };
  const q = useQuery({ queryKey: ['messages', query], queryFn: () => api.page<Message[]>('/sms', query) });
  const rows = q.data?.data || [];

  return (
    <div className="animate-rise">
      <div className={embedded ? 'flex justify-end -mt-2 mb-3' : ''}>{!embedded && <PageHeader title="Message log" subtitle="Every SMS you’ve sent, with its delivery status." />}
        {rows.length > 0 && <Button variant="outline" icon={<Download className="h-4 w-4" />} onClick={() => downloadCsv('messages.csv', [['to', 'status', 'sender', 'segments', 'cost_tzs', 'created_at', 'delivered_at', 'body'], ...rows.map((m) => [m.to_phone, m.status, m.sender_id, m.segments, m.cost_tzs, m.created_at, m.delivered_at, m.body])])}>Download this page</Button>}</div>
      <div className="grid grid-cols-2 sm:grid-cols-[200px_180px_180px] gap-2 mb-4">
        <Select className="col-span-2 sm:col-span-1" value={status} onChange={(e) => { setStatus(e.target.value as MessageStatus | ''); setPage(1); }} aria-label="Status">
          <option value="">All statuses</option><option value="delivered">Delivered</option><option value="sent">Sent</option><option value="queued">Queued</option><option value="failed">Failed</option><option value="rejected">Rejected</option>
        </Select>
        <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From date" />
        <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To date" />
      </div>
      <div className="panel overflow-hidden">
        {q.isLoading ? <TableSkeleton /> : q.isError ? <ErrorBox error={q.error} onRetry={() => q.refetch()} /> : !rows.length ? (
          <Empty icon={<MessagesSquare className="h-6 w-6" />} title="No messages found" body={status || from || to ? 'Try clearing the filters.' : 'Messages you send will appear here.'} />
        ) : (
          <>
            <ul className="sm:hidden divide-y divide-line">
              {rows.map((m) => (
                <li key={m.id}><button onClick={() => setOpen(m)} className="w-full text-left px-4 py-3">
                  <div className="flex items-center justify-between gap-2"><span className="font-semibold tabular-nums">{m.to_phone}</span><StatusBadge status={m.status} /></div>
                  <p className="text-sm text-ink-500 truncate mt-0.5">{m.body}</p>
                  <div className="text-[12px] text-ink-400 mt-0.5">{dateTime(m.created_at)} · {m.sender_id}</div>
                </button></li>
              ))}
            </ul>
            <div className="hidden sm:block overflow-x-auto">
              <table className="table-base">
                <thead><tr><th>To</th><th>Message</th><th>From</th><th>Status</th><th>Parts</th><th>Cost</th><th>Time</th></tr></thead>
                <tbody>
                  {rows.map((m) => (
                    <tr key={m.id} className="hover:bg-paper/60 cursor-pointer" onClick={() => setOpen(m)}>
                      <td className="font-medium tabular-nums whitespace-nowrap">{m.to_phone}</td>
                      <td className="max-w-[300px] truncate text-ink-700">{m.body}</td>
                      <td className="font-mono text-[13px]">{m.sender_id}</td>
                      <td><StatusBadge status={m.status} /></td>
                      <td className="tabular-nums">{m.segments}</td>
                      <td className="tabular-nums whitespace-nowrap">{tzs(m.cost_tzs)}</td>
                      <td className="text-ink-500 whitespace-nowrap">{dateTime(m.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <Pager page={page} perPage={50} total={q.data?.meta?.total} onPage={setPage} />
      </div>
      <Modal open={!!open} onClose={() => setOpen(null)} title="Message details">
        {open && (
          <div>
            <div className="bubble-out whitespace-pre-wrap break-words">{open.body}</div>
            <dl className="mt-5 grid grid-cols-2 gap-y-3 text-sm">
              {[['To', open.to_phone], ['From', open.sender_id], ['Status', <StatusBadge key="s" status={open.status} />], ['Encoding', open.encoding], ['Parts', open.segments], ['Cost', tzs(open.cost_tzs)], ['Created', dateTime(open.created_at)], ['Delivered', dateTime(open.delivered_at)], ['Error', open.error_code || '—'], ['Reference', open.reference || '—']].map(([k, v]) => (
                <div key={String(k)}><dt className="text-ink-500">{k}</dt><dd className="font-semibold">{v}</dd></div>
              ))}
            </dl>
            <p className="mt-4 text-[12px] text-ink-400 font-mono break-all">ID {open.id}</p>
          </div>
        )}
      </Modal>
    </div>
  );
}
