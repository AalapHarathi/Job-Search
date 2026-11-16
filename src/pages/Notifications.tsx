import { Bell, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { PageHeader, Empty, Button, IconButton } from '@/components/ui';
import { deleteNotification, markAllNotificationsRead, markNotificationRead } from '@/lib/db';
import { fmtDate } from '@/lib/format';

export function Notifications() {
  const { notifications, unread } = useData();
  const { user } = useAuth();
  const { openJob } = useUI();
  return (
    <div className="max-w-3xl">
      <PageHeader title="Notifications" actions={unread > 0 && <Button onClick={() => markAllNotificationsRead(user!.uid, notifications.filter((n) => !n.read).map((n) => n.id))}>Mark all read</Button>} />
      <div className="panel">
        {!notifications.length ? <Empty icon={<Bell className="size-6" />} title="No notifications">You’ll hear about strong new matches, closing deadlines and follow-ups here.</Empty> : (
          <ul className="divide-y divide-line">
            {notifications.map((n) => (
              <li key={n.id} className="flex items-start gap-3 px-4 py-3">
                <span className={clsx('mt-2 size-2 rounded-full shrink-0', n.read ? 'bg-line' : 'bg-accent')} />
                <button className="min-w-0 flex-1 text-left" onClick={() => { markNotificationRead(user!.uid, n.id); if (n.jobId) openJob(n.jobId); }}>
                  <span className={clsx('block text-sm', !n.read && 'font-medium')}>{n.title}</span>
                  <span className="block text-sm text-muted mt-0.5">{n.body}</span>
                  <span className="block text-xs text-faint mt-1">{fmtDate(n.createdAt, true)}</span>
                </button>
                <IconButton label="Delete notification" onClick={() => deleteNotification(user!.uid, n.id)}><Trash2 className="size-4" /></IconButton>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
