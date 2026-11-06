import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App';
import { AuthProvider } from './lib/auth';
import { ToastProvider } from './components/Toast';
import { ApiError, API_URL } from './lib/api';
import { installDemoApi } from './demo/mockApi';

const DEMO = import.meta.env.VITE_DEMO === '1';
if (DEMO) installDemoApi(API_URL);
const Router = DEMO ? MemoryRouter : BrowserRouter;
import './index.css';

const qc = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      retry: (n, e) => !(e instanceof ApiError && [400, 401, 403, 404].includes(e.status)) && n < 2,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={qc}>
      <Router>
        <ToastProvider>
          <AuthProvider>
            <App />
          </AuthProvider>
        </ToastProvider>
      </Router>
    </QueryClientProvider>
  </React.StrictMode>,
);
