import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu as MenuIcon, Moon, Sun, LogOut, X } from 'lucide-react';
import clsx from 'clsx';
import { Sidebar } from './Sidebar';
import { NotificationsBell } from './NotificationsBell';
import { RefreshPill } from './RefreshStatus';
import { useTheme } from '@/context/ThemeContext';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useUI } from '@/context/UIContext';
import { IconButton, Spinner } from '@/components/ui';
import { JobDrawer } from '@/components/jobs/JobDrawer';
import { ApplyModal } from '@/components/jobs/ApplyModal';
import { Menu } from '@/components/ui/Menu';

function Brand() {
  return (
    <div className="flex items-center gap-2.5 px-5 h-14">
      <svg viewBox="0 0 32 32" className="size-6" aria-hidden><rect width="32" height="32" rx="7" fill="rgb(var(--accent))" /><rect x="7" y="17" width="4" height="8" rx="1" fill="white" /><rect x="14" y="12" width="4" height="13" rx="1" fill="white" /><rect x="21" y="7" width="4" height="18" rx="1" fill="white" /></svg>
      <span className="text-[0.9375rem] font-semibold tracking-[-0.01em]">Career Intel</span>
    </div>
  );
}

export function AppShell() {
  const [mobileNav, setMobileNav] = useState(false);
  const { theme, toggle } = useTheme();
  const { user, logout } = useAuth();
  const { ready, error } = useData();
  const { toasts } = useUI();
  const loc = useLocation();

  return (
    <div className="min-h-full lg:grid lg:grid-cols-[15rem_1fr]">
      <aside className="hidden lg:flex flex-col sticky top-0 h-screen border-r border-line bg-canvas overflow-y-auto">
        <Brand />
        <Sidebar />
      </aside>

      {mobileNav && (
        <div className="lg:hidden fixed inset-0 z-50">
          <div className="absolute inset-0 bg-black/40 anim-fade" onClick={() => setMobileNav(false)} />
          <aside className="absolute left-0 top-0 h-full w-72 bg-canvas border-r border-line overflow-y-auto anim-drawer">
            <div className="flex items-center justify-between pr-3"><Brand /><IconButton label="Close menu" onClick={() => setMobileNav(false)}><X className="size-4" /></IconButton></div>
            <Sidebar onNavigate={() => setMobileNav(false)} />
          </aside>
        </div>
      )}

      <div className="min-w-0 flex flex-col">
        <header className="sticky top-0 z-30 h-14 flex items-center gap-2 px-4 lg:px-8 border-b border-line bg-canvas/85 backdrop-blur" style={{ paddingTop: 'env(safe-area-inset-top, 0px)' }}>
          <IconButton label="Open menu" className="lg:hidden -ml-1" onClick={() => setMobileNav(true)}><MenuIcon className="size-4" /></IconButton>
          <div className="flex-1" />
          <RefreshPill />
          <NotificationsBell />
          <IconButton label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'} onClick={toggle}>{theme === 'dark' ? <Sun className="size-4" /> : <Moon className="size-4" />}</IconButton>
          <Menu
            trigger={() => (
              <button aria-label="Account" className="ml-1 size-8 rounded-full bg-accent-soft text-accent text-xs font-semibold inline-flex items-center justify-center overflow-hidden">
                {user?.photoURL ? <img src={user.photoURL} alt="" className="size-8" referrerPolicy="no-referrer" /> : (user?.email?.[0] ?? '?').toUpperCase()}
              </button>
            )}
            items={[{ label: user?.email ?? 'Account', disabled: true }, 'sep', { label: 'Sign out', icon: <LogOut className="size-4" />, onClick: logout }]}
          />
        </header>

        <main key={loc.pathname} className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-[90rem] w-full mx-auto" style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}>
          {error && <div role="alert" className="mb-4 rounded-lg border border-bad/30 bg-bad/5 p-3 text-sm text-bad">{error}</div>}
          {ready ? <Outlet /> : <div className="flex justify-center py-24"><Spinner className="size-6" /></div>}
        </main>
      </div>

      <JobDrawer />
      <ApplyModal />

      <div aria-live="polite" className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[60] flex flex-col items-center gap-2 pointer-events-none" style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        {toasts.map((t) => (
          <div key={t.id} className={clsx('pointer-events-auto anim-pop rounded-lg px-3.5 py-2 text-sm shadow-pop max-w-[90vw]', t.tone === 'error' ? 'bg-bad text-white' : 'bg-ink text-canvas')}>{t.text}</div>
        ))}
      </div>
    </div>
  );
}
