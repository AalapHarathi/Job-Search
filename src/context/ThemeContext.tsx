import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

type Theme = 'light' | 'dark';
const Ctx = createContext<{ theme: Theme; toggle: () => void; set: (t: Theme) => void }>({ theme: 'light', toggle: () => {}, set: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.classList.contains('dark') ? 'dark' : 'light'));
  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    // UI preference only — no personal or application data lives in browser storage.
    try { localStorage.setItem('ci-theme', theme); } catch { /* storage unavailable */ }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === 'dark' ? 'light' : 'dark')), []);
  return <Ctx.Provider value={{ theme, toggle, set: setTheme }}>{children}</Ctx.Provider>;
}

export const useTheme = () => useContext(Ctx);
