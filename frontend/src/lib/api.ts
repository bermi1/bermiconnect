export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000/v1').replace(/\/$/, '');
export const DOCS_URL = import.meta.env.VITE_DOCS_URL || '/docs';

const TOKEN_KEY = 'bc_token';

export const tokenStore = {
  get: () => {
    try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
  },
  set: (t: string) => { try { localStorage.setItem(TOKEN_KEY, t); } catch { /* ignore */ } },
  clear: () => { try { localStorage.removeItem(TOKEN_KEY); } catch { /* ignore */ } },
};

export class ApiError extends Error {
  code: string;
  status: number;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export interface Paged<T> {
  data: T;
  meta?: { page: number; per_page: number; total: number };
}

type Query = Record<string, string | number | boolean | undefined | null>;

function qs(q?: Query) {
  if (!q) return '';
  const p = new URLSearchParams();
  Object.entries(q).forEach(([k, v]) => {
    if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  });
  const s = p.toString();
  return s ? `?${s}` : '';
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: () => void) { onUnauthorized = fn; }

async function request<T>(method: string, path: string, opts: { body?: unknown; query?: Query; form?: FormData } = {}): Promise<Paged<T>> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const token = tokenStore.get();
  if (token) headers.Authorization = `Bearer ${token}`;
  let body: BodyInit | undefined;
  if (opts.form) body = opts.form;
  else if (opts.body !== undefined) {
    headers['Content-Type'] = 'application/json';
    body = JSON.stringify(opts.body);
  }
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}${qs(opts.query)}`, { method, headers, body });
  } catch {
    throw new ApiError(0, 'network_error', 'Could not reach Bermi Connect. Check your internet connection and try again.');
  }
  let json: unknown = null;
  const text = await res.text();
  if (text) {
    try { json = JSON.parse(text); } catch { json = null; }
  }
  if (!res.ok) {
    const err = (json as { error?: { code?: string; message?: string } } | null)?.error;
    if (res.status === 401 && !path.startsWith('/auth/')) {
      tokenStore.clear();
      onUnauthorized?.();
    }
    throw new ApiError(res.status, err?.code || `http_${res.status}`, err?.message || `Request failed (${res.status}).`);
  }
  return (json ?? { data: null }) as Paged<T>;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, { query }).then((r) => r.data),
  page: <T>(path: string, query?: Query) => request<T>('GET', path, { query }),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, { body }).then((r) => r.data),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, { body }).then((r) => r.data),
  put: <T>(path: string, body?: unknown) => request<T>('PUT', path, { body }).then((r) => r.data),
  del: <T = unknown>(path: string) => request<T>('DELETE', path).then((r) => r.data),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, { form }).then((r) => r.data),
};

export function errMsg(e: unknown) {
  if (e instanceof ApiError) {
    if (e.code === 'insufficient_balance') return 'Not enough balance. Top up your wallet, then try again.';
    if (e.code === 'sender_not_approved') return 'That sender name is not approved yet. Use BERMI or wait for approval.';
    return e.message;
  }
  return e instanceof Error ? e.message : 'Something went wrong.';
}
