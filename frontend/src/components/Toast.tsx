import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

type Kind = 'success' | 'error' | 'info';
interface T { id: number; kind: Kind; text: string }
const Ctx = createContext<(kind: Kind, text: string) => void>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<T[]>([]);
  const push = useCallback((kind: Kind, text: string) => {
    const id = Date.now() + Math.random();
    setItems((s) => [...s.slice(-3), { id, kind, text }]);
    setTimeout(() => setItems((s) => s.filter((t) => t.id !== id)), kind === 'error' ? 6000 : 3800);
  }, []);
  return (
    <Ctx.Provider value={push}>
      {children}
      <div className="fixed z-[60] inset-x-0 top-3 sm:top-auto sm:bottom-6 sm:right-6 sm:left-auto flex flex-col items-center sm:items-end gap-2 px-4 pointer-events-none" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className="pointer-events-auto animate-rise flex items-start gap-3 w-full max-w-sm rounded-2xl bg-ink text-white px-4 py-3 shadow-2xl">
            {t.kind === 'success' ? <CheckCircle2 className="h-5 w-5 text-[#5fd3ad] shrink-0 mt-0.5" /> : t.kind === 'error' ? <AlertCircle className="h-5 w-5 text-[#ff8a80] shrink-0 mt-0.5" /> : <Info className="h-5 w-5 text-amber shrink-0 mt-0.5" />}
            <p className="text-sm leading-snug flex-1">{t.text}</p>
            <button onClick={() => setItems((s) => s.filter((x) => x.id !== t.id))} aria-label="Dismiss" className="opacity-60 hover:opacity-100"><X className="h-4 w-4" /></button>
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const push = useContext(Ctx);
  return { success: (t: string) => push('success', t), error: (t: string) => push('error', t), info: (t: string) => push('info', t) };
}
