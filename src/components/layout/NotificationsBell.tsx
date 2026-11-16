import { Bell, CheckCheck } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import clsx from 'clsx';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { markAllNotificationsRead, markNotificationRead } from '@/lib/db';
import { fmtDateTimeRel } from '@/lib/format';

export function NotificationsBell() {
  const { notifications, unread } = useData();
  const { user } = useAuth();
  const { openJob } = useUI();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', h);
    return () => document.removeEventListener('mousedown', h);
  }, [open]);
  return (
    <div className="relative" ref={ref}>
      <button aria-label={`Notifications${unread ? `, ${unread} unread` : ''}`} onClick={() => setOpen((o) => !o)} className="relative size-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-raised">
        <Bell className="size-4" />
        {unread > 0 && <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 rounded-full bg-accent text-[0.625rem] font-semibold text-white dark:text-[#0f1115] flex items-center justify-center num">{unread > 99 ? '99+' : unread}</span>}
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-[22rem] max-w-[calc(100vw-1.5rem)] rounded-xl border border-line bg-surface shadow-pop anim-pop z-40">
          <div className="flex items-center justify-between px-4 h-11 border-b border-line">
            <span className="text-sm font-semibold">Notifications</span>
            {unread > 0 && <button className="text-xs text-accent inline-flex items-center gap-1 hover:underline" onClick={() => markAllNotificationsRead(user!.uid, notifications.filter((n) => !n.read).map((n) => n.id))}><CheckCheck className="size-3.5" />Mark all read</button>}
          </div>
          <ul className="max-h-[24rem] overflow-y-auto divide-y divide-line">
            {notifications.slice(0, 15).map((n) => (
              <li key={n.id}>
                <button className="w-full text-left px-4 py-3 hover:bg-raised flex gap-3" onClick={() => { markNotificationRead(user!.uid, n.id); if (n.jobId) openJob(n.jobId); setOpen(false); }}>
                  <span className={clsx('mt-1.5 size-2 rounded-full shrink-0', n.read ? 'bg-transparent' : 'bg-accent')} />
                  <span className="min-w-0">
                    <span className="block text-sm font-medium leading-snug">{n.title}</span>
                    <span className="block text-xs text-muted mt-0.5 line-clamp-2">{n.body}</span>
                    <span className="block text-2xs text-faint mt-1">{fmtDateTimeRel(n.createdAt)}</span>
                  </span>
                </button>
              </li>
            ))}
            {!notifications.length && <li className="px-4 py-10 text-center text-sm text-muted">You’re all caught up.</li>}
          </ul>
          <Link to="/notifications" onClick={() => setOpen(false)} className="block text-center text-xs text-accent py-2.5 border-t border-line hover:underline">All notifications</Link>
        </div>
      )}
    </div>
  );
}
