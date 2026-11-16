import { NavLink } from 'react-router-dom';
import clsx from 'clsx';
import {
  LayoutGrid, Compass, Star, Bookmark, Send, KanbanSquare, XCircle, FileText, BarChart3, SlidersHorizontal, Settings,
} from 'lucide-react';
import { useData } from '@/context/DataContext';
import { recommended, isOpen } from '@/lib/jobQueries';
import { INTERVIEW_STATUSES } from '@shared/types';
import { useMemo } from 'react';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const { jobs, prefs, applications } = useData();
  const counts = useMemo(() => ({
    discover: jobs.filter(isOpen).length,
    rec: recommended(jobs, prefs).length,
    saved: jobs.filter((j) => ['Saved', 'Shortlisted', 'Ready to Apply'].includes(j.status)).length,
    applied: applications.length,
    pipeline: jobs.filter((j) => ['Assessment', ...INTERVIEW_STATUSES].includes(j.status)).length,
    rejected: jobs.filter((j) => ['Rejected', 'Withdrawn', 'Not Interested'].includes(j.status)).length,
  }), [jobs, prefs, applications]);

  const groups: { label: string | null; items: { to: string; label: string; icon: typeof Compass; count?: number }[] }[] = [
    { label: null, items: [
      { to: '/', label: 'Overview', icon: LayoutGrid },
      { to: '/discover', label: 'Discover jobs', icon: Compass, count: counts.discover },
      { to: '/recommended', label: 'Recommended for me', icon: Star, count: counts.rec },
    ] },
    { label: 'Track', items: [
      { to: '/saved', label: 'Saved jobs', icon: Bookmark, count: counts.saved },
      { to: '/applied', label: 'Applied jobs', icon: Send, count: counts.applied },
      { to: '/pipeline', label: 'Interview pipeline', icon: KanbanSquare, count: counts.pipeline },
      { to: '/rejected', label: 'Rejected & closed', icon: XCircle, count: counts.rejected },
    ] },
    { label: 'Insight', items: [
      { to: '/resume', label: 'Resume intelligence', icon: FileText },
      { to: '/analytics', label: 'Analytics', icon: BarChart3 },
    ] },
    { label: 'Configure', items: [
      { to: '/preferences', label: 'Search preferences', icon: SlidersHorizontal },
      { to: '/settings', label: 'Settings', icon: Settings },
    ] },
  ];

  return (
    <nav aria-label="Main" className="flex flex-col gap-5 px-3 py-4">
      {groups.map((g, gi) => (
        <div key={gi}>
          {g.label && <div className="px-2.5 mb-1 text-xs text-faint">{g.label}</div>}
          <ul className="space-y-px">
            {g.items.map((it) => (
              <li key={it.to}>
                <NavLink to={it.to} end={it.to === '/'} onClick={onNavigate}
                  className={({ isActive }) => clsx('flex items-center gap-2.5 h-8 px-2.5 rounded-lg text-[0.8125rem] transition-colors',
                    isActive ? 'bg-surface text-ink font-medium shadow-[0_0_0_1px_rgb(var(--line))]' : 'text-muted hover:text-ink hover:bg-surface/60')}>
                  {({ isActive }) => (
                    <>
                      <it.icon className={clsx('size-4', isActive ? 'text-accent' : '')} strokeWidth={1.8} />
                      <span className="flex-1 truncate">{it.label}</span>
                      {!!it.count && <span className="num text-xs text-faint">{it.count}</span>}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}
