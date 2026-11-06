import { NavLink, Outlet, Link, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import { LayoutGrid, Send, Megaphone, Users, FileText, BadgeCheck, MessagesSquare, Wallet, Code2, Settings, LogOut, Menu, X, Plus } from 'lucide-react';
import { Logo } from './Logo';
import { useAuth } from '../lib/auth';
import { useBalance } from '../lib/hooks';
import { tzs } from '../lib/format';
import { cx } from './ui';

const NAV = [
  { to: '/app', label: 'Overview', icon: LayoutGrid, end: true },
  { to: '/app/send', label: 'Quick send', icon: Send },
  { to: '/app/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/app/contacts', label: 'Contacts', icon: Users },
  { to: '/app/templates', label: 'Templates', icon: FileText },
  { to: '/app/messages', label: 'Message log', icon: MessagesSquare },
  { to: '/app/sender-ids', label: 'Sender names', icon: BadgeCheck },
  { to: '/app/wallet', label: 'Wallet', icon: Wallet },
  { to: '/app/developers', label: 'Developers', icon: Code2 },
  { to: '/app/settings', label: 'Settings', icon: Settings },
];

function NavItems({ onNav }: { onNav?: () => void }) {
  return (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ to, label, icon: Icon, end }) => (
        <NavLink key={to} to={to} end={end} onClick={onNav}
          className={({ isActive }) => cx('flex items-center gap-3 h-11 px-3 rounded-xl text-[15px] font-medium transition-colors',
            isActive ? 'bg-white/10 text-white' : 'text-white/60 hover:text-white hover:bg-white/5')}>
          {({ isActive }) => (<><Icon className={cx('h-[18px] w-[18px]', isActive && 'text-amber')} />{label}</>)}
        </NavLink>
      ))}
    </nav>
  );
}

function SideFooter() {
  const { user, account, signOut } = useAuth();
  const bal = useBalance();
  return (
    <div className="mt-auto space-y-3">
      <Link to="/app/wallet" className="block rounded-2xl bg-white/[0.06] p-4 hover:bg-white/10 transition-colors">
        <div className="text-[13px] text-white/50">Balance</div>
        <div className="text-xl font-bold text-white tabular-nums">{bal.data ? tzs(bal.data.balance_tzs) : account ? tzs(account.balance_tzs) : '—'}</div>
        <div className="text-[13px] text-amber mt-1 font-medium">Top up</div>
      </Link>
      <div className="flex items-center gap-3 px-1">
        <div className="h-9 w-9 rounded-full bg-amber text-ink grid place-items-center font-bold text-sm">{(user?.name || '?').slice(0, 1).toUpperCase()}</div>
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold text-white truncate">{user?.name}</div>
          <div className="text-xs text-white/50 truncate">{account?.name}</div>
        </div>
        <button onClick={signOut} className="h-9 w-9 grid place-items-center rounded-lg text-white/50 hover:text-white hover:bg-white/10" aria-label="Sign out" title="Sign out"><LogOut className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

const BOTTOM = [
  { to: '/app', label: 'Home', icon: LayoutGrid, end: true },
  { to: '/app/campaigns', label: 'Campaigns', icon: Megaphone },
  { to: '/app/contacts', label: 'Contacts', icon: Users },
  { to: '/app/wallet', label: 'Wallet', icon: Wallet },
];

export default function AppLayout() {
  const [drawer, setDrawer] = useState(false);
  const loc = useLocation();
  useEffect(() => { setDrawer(false); window.scrollTo(0, 0); }, [loc.pathname]);

  return (
    <div className="min-h-screen lg:pl-[264px]">
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex fixed inset-y-0 left-0 w-[264px] flex-col bg-ink px-4 py-5">
        <Link to="/app" className="px-2 mb-6"><Logo dark /></Link>
        <Link to="/app/campaigns/new" className="btn btn-md btn-accent w-full mb-5"><Plus className="h-4 w-4" />New campaign</Link>
        <NavItems />
        <SideFooter />
      </aside>

      {/* Mobile top bar */}
      <header className="lg:hidden sticky top-0 z-30 h-14 flex items-center justify-between px-4 bg-paper/90 backdrop-blur border-b border-line">
        <Link to="/app"><Logo /></Link>
        <button onClick={() => setDrawer(true)} className="h-10 w-10 -mr-2 grid place-items-center rounded-xl hover:bg-ink/5" aria-label="Open menu"><Menu className="h-5 w-5" /></button>
      </header>

      {drawer && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-ink/50" onClick={() => setDrawer(false)} />
          <div className="absolute right-0 inset-y-0 w-[86%] max-w-[320px] bg-ink px-4 py-5 flex flex-col animate-rise overflow-y-auto">
            <div className="flex items-center justify-between mb-6 px-2">
              <Logo dark />
              <button onClick={() => setDrawer(false)} className="h-10 w-10 grid place-items-center rounded-xl text-white/70 hover:bg-white/10" aria-label="Close menu"><X className="h-5 w-5" /></button>
            </div>
            <NavItems onNav={() => setDrawer(false)} />
            <div className="h-6" />
            <SideFooter />
          </div>
        </div>
      )}

      <main className="px-4 sm:px-6 lg:px-10 py-6 lg:py-10 pb-28 lg:pb-12 max-w-[1240px]">
        <Outlet />
      </main>

      {/* Mobile bottom nav with central Tuma button */}
      <nav className="lg:hidden fixed bottom-0 inset-x-0 z-40 bg-white border-t border-line pb-safe">
        <div className="grid grid-cols-5 h-16 items-center">
          {BOTTOM.slice(0, 2).map((b) => <BottomItem key={b.to} {...b} />)}
          <div className="flex justify-center">
            <Link to="/app/send" className="-mt-7 h-16 w-16 rounded-full bg-amber text-ink grid place-items-center shadow-[0_6px_20px_-6px_rgba(245,165,36,.8)] ring-4 ring-paper" aria-label="Tuma SMS">
              <span className="flex flex-col items-center leading-none">
                <Send className="h-5 w-5" />
                <span className="text-[11px] font-bold mt-1">Tuma</span>
              </span>
            </Link>
          </div>
          {BOTTOM.slice(2).map((b) => <BottomItem key={b.to} {...b} />)}
        </div>
      </nav>
    </div>
  );
}

function BottomItem({ to, label, icon: Icon, end }: { to: string; label: string; icon: typeof Send; end?: boolean }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => cx('flex flex-col items-center gap-1 text-[11px] font-semibold', isActive ? 'text-brand' : 'text-ink-400')}>
      <Icon className="h-[22px] w-[22px]" />{label}
    </NavLink>
  );
}
