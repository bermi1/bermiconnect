import { ReactNode, useEffect, forwardRef, InputHTMLAttributes, TextareaHTMLAttributes, SelectHTMLAttributes } from 'react';
import { X, Loader2 } from 'lucide-react';

export function cx(...c: (string | false | null | undefined)[]) { return c.filter(Boolean).join(' '); }

export function Spinner({ className = 'h-4 w-4' }: { className?: string }) {
  return <Loader2 className={cx('animate-spin', className)} aria-hidden />;
}

type BtnProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'accent' | 'ghost' | 'outline' | 'danger'; size?: 'sm' | 'md' | 'lg'; loading?: boolean; icon?: ReactNode;
};
export function Button({ variant = 'primary', size = 'md', loading, icon, children, className, disabled, ...rest }: BtnProps) {
  return (
    <button className={cx('btn', `btn-${size}`, `btn-${variant}`, className)} disabled={disabled || loading} {...rest}>
      {loading ? <Spinner /> : icon}
      {children}
    </button>
  );
}

export function Field({ label, hint, error, children, htmlFor, aside }: { label?: string; hint?: ReactNode; error?: string | null; children: ReactNode; htmlFor?: string; aside?: ReactNode }) {
  return (
    <div>
      {label && (
        <div className="flex items-baseline justify-between">
          <label htmlFor={htmlFor} className="field-label">{label}</label>
          {aside}
        </div>
      )}
      {children}
      {error ? <p className="err" role="alert">{error}</p> : hint ? <p className="hint">{hint}</p> : null}
    </div>
  );
}

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }>(
  ({ className, invalid, ...p }, ref) => <input ref={ref} className={cx('input', invalid && 'input-error', className)} {...p} />,
);
Input.displayName = 'Input';
export const Textarea = forwardRef<HTMLTextAreaElement, TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }>(
  ({ className, invalid, ...p }, ref) => <textarea ref={ref} className={cx('input', invalid && 'input-error', className)} {...p} />,
);
Textarea.displayName = 'Textarea';
export function Select({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <select className={cx('input appearance-none bg-[url("data:image/svg+xml,%3Csvg xmlns=%27http://www.w3.org/2000/svg%27 width=%2716%27 height=%2716%27 fill=%27none%27 stroke=%27%2355675F%27 stroke-width=%272%27%3E%3Cpath d=%27m4 6 4 4 4-4%27/%3E%3C/svg%3E")] bg-no-repeat bg-[right_12px_center] pr-10', className)} {...p}>{children}</select>;
}

export function Modal({ open, onClose, title, children, footer, size = 'md' }: { open: boolean; onClose: () => void; title: ReactNode; children: ReactNode; footer?: ReactNode; size?: 'md' | 'lg' }) {
  useEffect(() => {
    if (!open) return;
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', h); document.body.style.overflow = prev; };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center" role="dialog" aria-modal="true">
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={onClose} />
      <div className={cx('relative w-full bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl max-h-[92vh] flex flex-col animate-rise', size === 'lg' ? 'sm:max-w-2xl' : 'sm:max-w-lg')}>
        <div className="flex items-center justify-between gap-4 px-5 sm:px-6 pt-5 pb-3">
          <h2 className="text-lg font-bold tracking-tight">{title}</h2>
          <button onClick={onClose} className="h-9 w-9 -mr-2 grid place-items-center rounded-full hover:bg-ink/5" aria-label="Close"><X className="h-5 w-5" /></button>
        </div>
        <div className="px-5 sm:px-6 pb-5 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 sm:px-6 py-4 border-t border-line flex flex-col-reverse sm:flex-row sm:justify-end gap-2 pb-safe">{footer}</div>}
      </div>
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) { return <div className={cx('skeleton', className)} />; }

export function TableSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <div className="p-4 space-y-3">
      {Array.from({ length: rows }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
    </div>
  );
}

export function Empty({ icon, title, body, action }: { icon: ReactNode; title: string; body?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-14">
      <div className="h-14 w-14 rounded-2xl bg-brand-50 text-brand grid place-items-center mb-4">{icon}</div>
      <h3 className="text-base font-bold">{title}</h3>
      {body && <p className="mt-1 text-sm text-ink-500 max-w-sm">{body}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const msg = error instanceof Error ? error.message : 'Something went wrong.';
  return (
    <div className="m-4 rounded-xl border border-bad/30 bg-bad/5 p-4 text-sm flex flex-col sm:flex-row sm:items-center gap-3 justify-between">
      <span className="text-[#9b2c26]">{msg}</span>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}>Try again</Button>}
    </div>
  );
}

const STATUS_STYLES: Record<string, string> = {
  delivered: 'bg-ok/10 text-[#06614b]', completed: 'bg-ok/10 text-[#06614b]', approved: 'bg-ok/10 text-[#06614b]', active: 'bg-ok/10 text-[#06614b]',
  sent: 'bg-sky-100 text-sky-800', sending: 'bg-sky-100 text-sky-800',
  queued: 'bg-ink/5 text-ink-700', draft: 'bg-ink/5 text-ink-700', scheduled: 'bg-amber-100 text-amber-700', pending: 'bg-amber-100 text-amber-700',
  failed: 'bg-bad/10 text-[#9b2c26]', rejected: 'bg-bad/10 text-[#9b2c26]', cancelled: 'bg-ink/5 text-ink-500', revoked: 'bg-ink/5 text-ink-500', inactive: 'bg-ink/5 text-ink-500',
};
const STATUS_LABEL: Record<string, string> = {
  delivered: 'Delivered', completed: 'Completed', approved: 'Approved', sent: 'Sent', sending: 'Sending', queued: 'Queued',
  draft: 'Draft', scheduled: 'Scheduled', pending: 'Waiting for approval', failed: 'Failed', rejected: 'Rejected', cancelled: 'Cancelled',
  revoked: 'Revoked', active: 'Active', inactive: 'Paused',
};
export function StatusBadge({ status, label }: { status: string; label?: string }) {
  const live = status === 'sending';
  return (
    <span className={cx('chip', STATUS_STYLES[status] || 'bg-ink/5 text-ink-700')}>
      <span className={cx('h-1.5 w-1.5 rounded-full bg-current', live && 'animate-pulse')} />
      {label || STATUS_LABEL[status] || status}
    </span>
  );
}

export function PageHeader({ title, subtitle, actions }: { title: ReactNode; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="text-[26px] sm:text-[30px] leading-tight font-extrabold tracking-[-0.02em]">{title}</h1>
        {subtitle && <p className="mt-1 text-ink-500 text-[15px]">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2 flex-wrap">{actions}</div>}
    </div>
  );
}

export function Pager({ page, perPage, total, onPage }: { page: number; perPage: number; total?: number; onPage: (p: number) => void }) {
  if (!total || total <= perPage) return null;
  const pages = Math.ceil(total / perPage);
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-line text-sm text-ink-500">
      <span>Page {page} of {pages} · {total.toLocaleString()} total</span>
      <div className="flex gap-2">
        <Button size="sm" variant="outline" disabled={page <= 1} onClick={() => onPage(page - 1)}>Previous</Button>
        <Button size="sm" variant="outline" disabled={page >= pages} onClick={() => onPage(page + 1)}>Next</Button>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)}
      className={cx('relative h-7 w-12 rounded-full transition-colors', checked ? 'bg-brand' : 'bg-ink/15')}>
      <span className={cx('absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all', checked ? 'left-6' : 'left-1')} />
    </button>
  );
}
