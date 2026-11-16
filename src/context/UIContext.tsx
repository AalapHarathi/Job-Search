import { createContext, useCallback, useContext, useState, type ReactNode } from 'react';

interface Toast { id: number; text: string; tone: 'ok' | 'error' }
interface UIState {
  openJobId: string | null;
  openJob: (id: string | null, tab?: string) => void;
  jobTab: string;
  setJobTab: (t: string) => void;
  applyJobId: string | null;
  openApply: (id: string | null) => void;
  toast: (text: string, tone?: 'ok' | 'error') => void;
  toasts: Toast[];
}
const Ctx = createContext<UIState | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [openJobId, setOpen] = useState<string | null>(null);
  const [jobTab, setJobTab] = useState('overview');
  const [applyJobId, setApply] = useState<string | null>(null);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toast = useCallback((text: string, tone: 'ok' | 'error' = 'ok') => {
    const id = Date.now() + Math.random();
    setToasts((t) => [...t, { id, text, tone }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), tone === 'error' ? 6000 : 3200);
  }, []);
  const openJob = useCallback((id: string | null, tab = 'overview') => { setOpen(id); setJobTab(tab); }, []);
  return (
    <Ctx.Provider value={{ openJobId, openJob, jobTab, setJobTab, applyJobId, openApply: setApply, toast, toasts }}>
      {children}
    </Ctx.Provider>
  );
}

export function useUI() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useUI outside provider');
  return c;
}
