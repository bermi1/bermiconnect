import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { ReactNode } from 'react';
import { useAuth } from './lib/auth';
import { tokenStore } from './lib/api';
import AppLayout from './components/AppLayout';
import Landing from './pages/Landing';
import { Login, Register } from './pages/Auth';
import Dashboard from './pages/Dashboard';
import QuickSend from './pages/QuickSend';
import Campaigns from './pages/Campaigns';
import CampaignWizard from './pages/CampaignWizard';
import CampaignDetail from './pages/CampaignDetail';
import Contacts from './pages/Contacts';
import Templates from './pages/Templates';
import SenderIds from './pages/SenderIds';
import Messages from './pages/Messages';
import Wallet from './pages/Wallet';
import Developers from './pages/Developers';
import Settings from './pages/Settings';
import { Spinner } from './components/ui';

function Protected({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const loc = useLocation();
  if (!tokenStore.get()) return <Navigate to={`/login?next=${encodeURIComponent(loc.pathname)}`} replace />;
  if (loading && !user) return <div className="min-h-screen grid place-items-center"><Spinner className="h-6 w-6 text-brand" /></div>;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/app" element={<Protected><AppLayout /></Protected>}>
        <Route index element={<Dashboard />} />
        <Route path="send" element={<QuickSend />} />
        <Route path="campaigns" element={<Campaigns />} />
        <Route path="campaigns/new" element={<CampaignWizard />} />
        <Route path="campaigns/:id" element={<CampaignDetail />} />
        <Route path="contacts" element={<Contacts />} />
        <Route path="templates" element={<Templates />} />
        <Route path="sender-ids" element={<SenderIds />} />
        <Route path="messages" element={<Messages />} />
        <Route path="wallet" element={<Wallet />} />
        <Route path="developers" element={<Developers />} />
        <Route path="settings" element={<Settings />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
