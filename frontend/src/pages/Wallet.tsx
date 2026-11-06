import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Plus, ArrowDownLeft, ArrowUpRight, RotateCcw, Gift, Smartphone, CreditCard, Receipt } from 'lucide-react';
import { api, errMsg } from '../lib/api';
import type { Transaction } from '../lib/types';
import { useBalance } from '../lib/hooks';
import { Button, Empty, ErrorBox, Field, Input, Modal, PageHeader, Pager, Skeleton, TableSkeleton, cx } from '../components/ui';
import { useToast } from '../components/Toast';
import { dateTime, int, num, tzs } from '../lib/format';
import { normalisePhone, PRICE_TZS } from '../lib/sms';
import { useAuth } from '../lib/auth';

const TX_ICON = { topup: ArrowDownLeft, charge: ArrowUpRight, refund: RotateCcw, bonus: Gift } as const;
const TX_LABEL = { topup: 'Top-up', charge: 'SMS sent', refund: 'Refund', bonus: 'Bonus' } as const;

export default function Wallet() {
  const bal = useBalance();
  const [sp, setSp] = useSearchParams();
  const [open, setOpen] = useState(sp.get('topup') === '1');
  const [page, setPage] = useState(1);
  const tx = useQuery({ queryKey: ['transactions', page], queryFn: () => api.page<Transaction[]>('/transactions', { page, per_page: 30 }) });
  const rows = tx.data?.data || [];
  const price = bal.data?.price_per_sms_tzs || PRICE_TZS;
  useEffect(() => { if (sp.get('topup')) setSp({}, { replace: true }); }, [sp, setSp]);

  return (
    <div className="animate-rise">
      <PageHeader title="Wallet" subtitle={`Pay only for what you send. TZS ${price} per SMS.`} />
      <div className="grid md:grid-cols-[1.3fr_1fr] gap-4 mb-6">
        <div className="rounded-3xl bg-ink text-white p-6 sm:p-7 relative overflow-hidden">
          <div className="absolute -right-10 -top-10 h-44 w-44 rounded-full border-[18px] border-white/[0.04]" aria-hidden />
          <div className="text-white/60">Balance</div>
          {bal.isLoading ? <Skeleton className="h-12 w-52 mt-2 bg-white/10" /> : <div className="mt-1 text-[44px] sm:text-[52px] font-black tabular-nums tracking-tight leading-none">{tzs(bal.data?.balance_tzs)}</div>}
          <div className="mt-3 text-white/60">Enough for about <b className="text-white">{int(Math.floor(num(bal.data?.balance_tzs) / price))}</b> SMS</div>
          <Button variant="accent" size="lg" className="mt-6" icon={<Plus className="h-5 w-5" />} onClick={() => setOpen(true)}>Top up</Button>
        </div>
        <div className="panel p-6">
          <h2 className="font-bold">How top-up works</h2>
          <ol className="mt-3 space-y-2.5 text-[15px] text-ink-700">
            <li className="flex gap-3"><span className="h-6 w-6 rounded-full bg-brand-50 text-brand-700 text-[13px] font-bold grid place-items-center shrink-0">1</span>Choose an amount and how you’ll pay.</li>
            <li className="flex gap-3"><span className="h-6 w-6 rounded-full bg-brand-50 text-brand-700 text-[13px] font-bold grid place-items-center shrink-0">2</span>Confirm the prompt on your phone with your PIN.</li>
            <li className="flex gap-3"><span className="h-6 w-6 rounded-full bg-brand-50 text-brand-700 text-[13px] font-bold grid place-items-center shrink-0">3</span>Your balance updates in seconds.</li>
          </ol>
        </div>
      </div>

      <div className="panel overflow-hidden">
        <div className="px-5 py-4 border-b border-line"><h2 className="font-bold text-lg">Transactions</h2></div>
        {tx.isLoading ? <TableSkeleton /> : tx.isError ? <ErrorBox error={tx.error} onRetry={() => tx.refetch()} /> : !rows.length ? (
          <Empty icon={<Receipt className="h-6 w-6" />} title="No transactions yet" body="Top-ups and SMS charges will show here." />
        ) : (
          <ul className="divide-y divide-line">
            {rows.map((t) => {
              const Icon = TX_ICON[t.type] || Receipt;
              const plus = num(t.amount_tzs) > 0 && t.type !== 'charge';
              return (
                <li key={t.id} className="flex items-center gap-4 px-5 py-3.5">
                  <span className={cx('h-10 w-10 rounded-xl grid place-items-center shrink-0', plus ? 'bg-ok/10 text-ok' : 'bg-ink/5 text-ink-500')}><Icon className="h-[18px] w-[18px]" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold truncate">{t.description || TX_LABEL[t.type]}</div>
                    <div className="text-[13px] text-ink-500">{TX_LABEL[t.type]} · {dateTime(t.created_at)}{t.status && t.status !== 'completed' ? ` · ${t.status}` : ''}</div>
                  </div>
                  <div className="text-right">
                    <div className={cx('font-bold tabular-nums', plus ? 'text-ok' : 'text-ink')}>{plus ? '+' : '−'}{tzs(Math.abs(num(t.amount_tzs)))}</div>
                    <div className="text-[12px] text-ink-400 tabular-nums">Bal {tzs(t.balance_after)}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <Pager page={page} perPage={30} total={tx.data?.meta?.total} onPage={setPage} />
      </div>
      {open && <TopupModal onClose={() => setOpen(false)} price={price} />}
    </div>
  );
}

const METHODS = [
  { v: 'mpesa', l: 'M-Pesa', c: '#E60000', icon: Smartphone },
  { v: 'tigopesa', l: 'Mixx by Yas (Tigo Pesa)', short: 'Tigo Pesa', c: '#00377B', icon: Smartphone },
  { v: 'airtel', l: 'Airtel Money', c: '#ED1C24', icon: Smartphone },
  { v: 'card', l: 'Card', c: '#0E0D2A', icon: CreditCard },
] as const;
const AMOUNTS = [5000, 10000, 25000, 50000, 100000];

function TopupModal({ onClose, price }: { onClose: () => void; price: number }) {
  const { account } = useAuth();
  const [amount, setAmount] = useState(10000);
  const [method, setMethod] = useState<(typeof METHODS)[number]['v']>('mpesa');
  const [phone, setPhone] = useState(account?.phone || '');
  const [err, setErr] = useState<string | null>(null);
  const qc = useQueryClient();
  const toast = useToast();
  const mobile = method !== 'card';
  const go = useMutation({
    mutationFn: () => {
      if (!amount || amount < 1000) throw new Error('The minimum top-up is TZS 1,000.');
      const p = mobile ? normalisePhone(phone) : undefined;
      if (mobile && !p) throw new Error('Enter the phone number that will pay.');
      return api.post<Transaction & { status?: string; checkout_url?: string }>('/wallet/topup', { amount_tzs: amount, method, ...(p ? { phone: p } : {}) });
    },
    onSuccess: (r) => {
      if (r?.checkout_url) { window.location.href = r.checkout_url; return; }
      toast.success(r?.status === 'pending' ? 'Check your phone and enter your PIN to confirm.' : `${tzs(amount)} added to your wallet.`);
      ['balance', 'transactions', 'stats'].forEach((k) => qc.invalidateQueries({ queryKey: [k] }));
      onClose();
    },
    onError: (e) => setErr(errMsg(e)),
  });

  return (
    <Modal open onClose={onClose} title="Top up wallet"
      footer={<><Button variant="ghost" onClick={onClose}>Cancel</Button><Button size="lg" loading={go.isPending} onClick={() => go.mutate()}>Pay {tzs(amount)}</Button></>}>
      <div className="space-y-5">
        <div>
          <span className="field-label">Amount</span>
          <div className="grid grid-cols-3 gap-2">
            {AMOUNTS.map((a) => (
              <button key={a} type="button" onClick={() => setAmount(a)} className={cx('h-12 rounded-xl border-2 font-semibold tabular-nums text-[15px]', amount === a ? 'border-brand bg-brand-50 text-brand-800' : 'border-line')}>{int(a)}</button>
            ))}
            <Input type="number" inputMode="numeric" min={1000} step={500} value={amount || ''} onChange={(e) => setAmount(+e.target.value)} aria-label="Custom amount" className="text-center font-semibold" />
          </div>
          <p className="hint">≈ {int(Math.floor(amount / price))} SMS</p>
        </div>
        <div>
          <span className="field-label">Pay with</span>
          <div className="grid grid-cols-2 gap-2">
            {METHODS.map((m) => (
              <button key={m.v} type="button" onClick={() => setMethod(m.v)} aria-pressed={method === m.v}
                className={cx('flex items-center gap-2.5 h-14 px-3 rounded-xl border-2 text-left', method === m.v ? 'border-brand bg-brand-50' : 'border-line')}>
                <span className="h-8 w-8 rounded-lg grid place-items-center text-white shrink-0" style={{ background: m.c }}><m.icon className="h-4 w-4" /></span>
                <span className="font-semibold text-[14px] leading-tight">{'short' in m ? m.short : m.l}</span>
              </button>
            ))}
          </div>
        </div>
        {mobile && <Field label="Paying phone number" hint="You’ll get a prompt on this phone."><Input type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="0754 123 456" /></Field>}
        {!mobile && <p className="text-sm text-ink-500">You’ll be taken to a secure card payment page.</p>}
        {err && <p className="err" role="alert">{err}</p>}
      </div>
    </Modal>
  );
}
