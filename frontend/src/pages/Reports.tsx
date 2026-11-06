import { useSearchParams } from 'react-router-dom';
import Campaigns from './Campaigns';
import Messages from './Messages';
import { PageHeader, cx } from '../components/ui';

const TABS = [
  { v: 'sends', l: 'Sends' },
  { v: 'messages', l: 'Every message' },
] as const;

/** Campaigns (incl. Excel sends) and the message log in one place. */
export default function Reports() {
  const [sp, setSp] = useSearchParams();
  const tab = sp.get('tab') === 'messages' ? 'messages' : 'sends';
  return (
    <div className="animate-rise">
      <PageHeader title="Reports" subtitle="See what was delivered, what failed (refunded) and download reports." />
      <div role="tablist" className="inline-flex p-1 rounded-2xl bg-ink/[0.06] mb-5">
        {TABS.map((t) => (
          <button key={t.v} role="tab" aria-selected={tab === t.v} onClick={() => setSp(t.v === 'sends' ? {} : { tab: t.v }, { replace: true })}
            className={cx('press h-10 px-5 rounded-xl text-[15px] font-semibold', tab === t.v ? 'bg-white shadow-sm text-ink' : 'text-ink-500')}>{t.l}</button>
        ))}
      </div>
      {tab === 'sends' ? <Campaigns embedded /> : <Messages embedded />}
    </div>
  );
}
