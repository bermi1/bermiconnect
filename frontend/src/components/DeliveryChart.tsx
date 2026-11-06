import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import type { DailyStat } from '../lib/types';

const C = { delivered: '#0A8C6C', failed: '#D9473F', other: '#A9B5AF' };

function fill14(daily: DailyStat[]) {
  const map = new Map(daily.map((d) => [d.date.slice(0, 10), d]));
  const out: (DailyStat & { label: string; pending: number })[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const row = map.get(key) || { date: key, sent: 0, delivered: 0, failed: 0 };
    const sent = Number(row.sent) || 0; const delivered = Number(row.delivered) || 0; const failed = Number(row.failed) || 0;
    out.push({ date: key, sent, delivered, failed, pending: Math.max(sent - delivered - failed, 0), label: d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }) });
  }
  return out;
}

function Tip({ active, payload, label }: { active?: boolean; payload?: { payload: DailyStat & { pending: number } }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  const p = payload[0].payload;
  return (
    <div className="rounded-xl bg-white border border-line shadow-lift px-3.5 py-2.5 text-[13px] min-w-[150px]">
      <div className="font-semibold mb-1.5">{label}</div>
      {([['Delivered', p.delivered, C.delivered], ['Failed', p.failed, C.failed], ['Waiting', p.pending, C.other]] as const).map(([k, v, c]) => (
        <div key={k} className="flex items-center gap-2 py-0.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: c }} />
          <span className="text-ink-500 flex-1">{k}</span>
          <span className="font-semibold tabular-nums">{v.toLocaleString()}</span>
        </div>
      ))}
      <div className="mt-1 pt-1 border-t border-line flex justify-between text-ink-500"><span>Sent</span><span className="font-semibold text-ink tabular-nums">{p.sent.toLocaleString()}</span></div>
    </div>
  );
}

export default function DeliveryChart({ daily }: { daily: DailyStat[] }) {
  const data = fill14(daily);
  return (
    <div>
      <div className="flex gap-4 text-[13px] text-ink-500 mb-3" aria-hidden>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.delivered }} />Delivered</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.failed }} />Failed</span>
        <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: C.other }} />Waiting for report</span>
      </div>
      <div className="h-[240px] -ml-2" role="img" aria-label="Messages sent per day over the last 14 days, split into delivered, failed and waiting">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} barCategoryGap="22%">
            <CartesianGrid vertical={false} stroke="#E3E3EE" />
            <XAxis dataKey="label" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#84839B' }} interval="preserveStartEnd" minTickGap={18} />
            <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#84839B' }} width={44} allowDecimals={false} />
            <Tooltip content={<Tip />} cursor={{ fill: 'rgba(32,31,91,.06)' }} />
            <Bar dataKey="delivered" stackId="a" fill={C.delivered} stroke="#fff" strokeWidth={2} />
            <Bar dataKey="failed" stackId="a" fill={C.failed} stroke="#fff" strokeWidth={2} />
            <Bar dataKey="pending" stackId="a" fill={C.other} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <details className="mt-2 text-[13px] text-ink-500">
        <summary className="cursor-pointer w-fit">Show as table</summary>
        <div className="overflow-x-auto mt-2">
          <table className="table-base"><thead><tr><th>Day</th><th>Sent</th><th>Delivered</th><th>Failed</th></tr></thead>
            <tbody>{data.map((d) => <tr key={d.date}><td>{d.label}</td><td className="tabular-nums">{d.sent}</td><td className="tabular-nums">{d.delivered}</td><td className="tabular-nums">{d.failed}</td></tr>)}</tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
