import { useMemo, useState } from 'react';
import { Send, Search, ExternalLink } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useUI } from '@/context/UIContext';
import { PageHeader, Empty, Select, Badge } from '@/components/ui';
import { MatchRibbon } from '@/components/jobs/MatchRibbon';
import { useJobActions } from '@/components/jobs/useJobActions';
import { APPLICATION_STATUSES, type ApplicationStatus } from '@shared/types';
import { daysUntil, fmtDate, safeUrl } from '@/lib/format';
import { norm } from '@shared/text';

export function Applied() {
  const { applications, jobsById } = useData();
  const { openJob } = useUI();
  const a = useJobActions();
  const [q, setQ] = useState('');
  const [status, setStatus] = useState<'' | ApplicationStatus>('');
  const rows = useMemo(() => applications
    .map((app) => ({ app, job: jobsById.get(app.jobId) }))
    .filter(({ app, job }) => (!q || norm(`${app.title} ${app.company}`).includes(norm(q))) && (!status || job?.status === status))
    .sort((x, y) => y.app.appliedDate.localeCompare(x.app.appliedDate)), [applications, jobsById, q, status]);

  return (
    <div>
      <PageHeader title="Applied jobs" description="Every application you’ve recorded, with its current stage, follow-up date and the resume version you sent." />
      <div className="flex flex-wrap gap-2 mb-4">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="size-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Search company or title" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search applications" />
        </div>
        <Select className="w-auto" value={status} onChange={(e) => setStatus(e.target.value as ApplicationStatus | '')} aria-label="Filter by status">
          <option value="">All stages</option>
          {APPLICATION_STATUSES.filter((s) => !['Discovered', 'Shortlisted', 'Saved', 'Ready to Apply', 'Not Interested'].includes(s)).map((s) => <option key={s}>{s}</option>)}
        </Select>
      </div>
      <div className="panel overflow-hidden">
        {!rows.length ? <Empty icon={<Send className="size-6" />} title={applications.length ? 'No applications match' : 'No applications recorded yet'}>Apply on the employer’s website, then press “Mark applied” on the vacancy.</Empty> : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[56rem]">
              <thead className="border-b border-line text-xs text-muted">
                <tr>{['Role', 'Applied', 'Stage', 'Next follow-up', 'Resume used', 'Match', ''].map((h) => <th key={h} className="px-3 first:pl-4 h-10 text-left font-medium">{h}</th>)}</tr>
              </thead>
              <tbody>
                {rows.map(({ app, job }) => {
                  const d = daysUntil(app.nextFollowUp);
                  return (
                    <tr key={app.jobId} className="border-b border-line last:border-0 hover:bg-raised/70 cursor-pointer" onClick={() => job && openJob(job.id, 'application')}>
                      <td className="pl-4 pr-3 py-3"><div className="font-medium">{app.title}</div><div className="text-[0.8125rem] text-muted">{app.company}{app.referral ? ' — referred' : ''}</div></td>
                      <td className="px-3 py-3 whitespace-nowrap">{fmtDate(app.appliedDate)}</td>
                      <td className="px-3 py-3" onClick={(e) => e.stopPropagation()}>
                        {job ? (
                          <Select className="h-8 w-auto text-[0.8125rem]" value={job.status} onChange={(e) => a.setStatus(job, e.target.value as ApplicationStatus)} aria-label="Stage">
                            {APPLICATION_STATUSES.map((s) => <option key={s}>{s}</option>)}
                          </Select>
                        ) : <Badge>Record missing</Badge>}
                      </td>
                      <td className="px-3 py-3 whitespace-nowrap">{app.nextFollowUp ? <span className={d !== null && d < 0 ? 'text-bad' : d === 0 ? 'text-warn' : ''}>{fmtDate(app.nextFollowUp)}{d !== null && d < 0 ? ' (overdue)' : d === 0 ? ' (today)' : ''}</span> : <span className="text-faint">Not set</span>}</td>
                      <td className="px-3 py-3 text-muted">{app.resumeVersionName ?? '—'}</td>
                      <td className="px-3 py-3">{job ? <MatchRibbon match={job.match} /> : app.matchScore ?? '—'}</td>
                      <td className="pr-3 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                        <a href={safeUrl(app.applicationUrl) ?? '#'} target="_blank" rel="noopener noreferrer" aria-label="Open application page" title="Open application page" className="size-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-surface"><ExternalLink className="size-4" /></a>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
