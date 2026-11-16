import clsx from 'clsx';
import { ArrowDown, ArrowUp, Bookmark, BookmarkCheck, ExternalLink, MapPin } from 'lucide-react';
import { useMemo, useState, type ReactNode } from 'react';
import type { Job } from '@shared/types';
import { COUNTRY_NAMES } from '@shared/geo';
import { sortJobs, type SortKey } from '@/lib/jobQueries';
import { fmtSalary, relDays, safeUrl } from '@/lib/format';
import { useUI } from '@/context/UIContext';
import { MatchRibbon } from './MatchRibbon';
import { FreshnessBadge, SponsorshipBadge, StatusBadge, VerificationBadge } from './badges';
import { JobRowMenu } from './JobRowMenu';
import { useJobActions } from './useJobActions';

export function locationLine(j: Job) {
  const where = j.location || (j.country ? COUNTRY_NAMES[j.country] : '') || 'Location not stated';
  return j.workArrangement !== 'Unknown' && !where.toLowerCase().includes(j.workArrangement.toLowerCase()) ? `${where} (${j.workArrangement})` : where;
}

function Th({ k, sort, setSort, children, className }: { k?: SortKey; sort: [SortKey, 'asc' | 'desc']; setSort: (s: [SortKey, 'asc' | 'desc']) => void; children: ReactNode; className?: string }) {
  const active = k && sort[0] === k;
  return (
    <th scope="col" className={clsx('px-3 h-10 text-left text-xs font-medium text-muted whitespace-nowrap', className)}>
      {k ? (
        <button className={clsx('inline-flex items-center gap-1 hover:text-ink', active && 'text-ink')} onClick={() => setSort([k, active && sort[1] === 'desc' ? 'asc' : 'desc'])}>
          {children}{active && (sort[1] === 'desc' ? <ArrowDown className="size-3" /> : <ArrowUp className="size-3" />)}
        </button>
      ) : children}
    </th>
  );
}

export function JobTable({ jobs, initialSort = ['match', 'desc'], showStatus = false, empty, pageSize = 50 }: { jobs: Job[]; initialSort?: [SortKey, 'asc' | 'desc']; showStatus?: boolean; empty?: ReactNode; pageSize?: number }) {
  const [sort, setSort] = useState<[SortKey, 'asc' | 'desc']>(initialSort);
  const [shown, setShown] = useState(pageSize);
  const { openJob } = useUI();
  const actions = useJobActions();
  const sorted = useMemo(() => sortJobs(jobs, sort[0], sort[1]), [jobs, sort]);
  if (!jobs.length) return <>{empty}</>;
  const rows = sorted.slice(0, shown);

  return (
    <div>
      {/* Desktop table */}
      <div className="hidden lg:block overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="border-b border-line">
            <tr>
              <Th k="title" sort={sort} setSort={setSort} className="pl-4">Role</Th>
              <Th k="location" sort={sort} setSort={setSort}>Location</Th>
              <Th k="posted" sort={sort} setSort={setSort}>Posted</Th>
              <Th k="salary" sort={sort} setSort={setSort}>Salary</Th>
              <Th k="match" sort={sort} setSort={setSort}>Match</Th>
              <Th sort={sort} setSort={setSort}>Sponsorship</Th>
              <Th k="verified" sort={sort} setSort={setSort}>Vacancy</Th>
              <th className="w-24" />
            </tr>
          </thead>
          <tbody>
            {rows.map((j) => {
              const apply = safeUrl(j.applicationUrl);
              return (
                <tr key={j.id} onClick={() => openJob(j.id)} className="border-b border-line last:border-0 hover:bg-raised/70 cursor-pointer group">
                  <td className="pl-4 pr-3 py-3 max-w-[22rem]">
                    <div className="font-medium truncate" title={j.title}>{j.title}</div>
                    <div className="text-muted text-[0.8125rem] truncate flex items-center gap-2">{j.company}{showStatus && j.status !== 'Discovered' && <StatusBadge status={j.status} />}</div>
                  </td>
                  <td className="px-3 py-3 text-muted max-w-[14rem]"><div className="truncate" title={locationLine(j)}>{locationLine(j)}</div></td>
                  <td className="px-3 py-3 whitespace-nowrap"><div className="text-[0.8125rem]">{j.postedAt ? relDays(j.postedAt) : <span className="text-faint">Not given</span>}</div><div className="mt-0.5"><FreshnessBadge job={j} /></div></td>
                  <td className="px-3 py-3 whitespace-nowrap text-[0.8125rem] num">{fmtSalary(j.salary)}</td>
                  <td className="px-3 py-3"><MatchRibbon match={j.match} /></td>
                  <td className="px-3 py-3"><SponsorshipBadge category={j.sponsorship.category} /></td>
                  <td className="px-3 py-3 whitespace-nowrap"><VerificationBadge status={j.verification.status} note={j.verification.note} /><div className="text-2xs text-faint mt-1">{j.lastVerifiedAt ? `Checked ${relDays(j.verification.checkedAt)}` : 'Never confirmed'}</div></td>
                  <td className="pr-3 py-3" onClick={(e) => e.stopPropagation()}>
                    <div className="flex items-center justify-end gap-0.5">
                      <button aria-label={j.status === 'Saved' ? 'Unsave' : 'Save job'} title={j.status === 'Saved' ? 'Unsave' : 'Save job'} onClick={() => actions.toggleSave(j)} className="size-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-surface">
                        {j.status === 'Saved' ? <BookmarkCheck className="size-4 text-accent" /> : <Bookmark className="size-4" />}
                      </button>
                      {apply && <a href={apply} target="_blank" rel="noopener noreferrer" aria-label="Apply on company site" title="Apply on company site" className="size-8 inline-flex items-center justify-center rounded-lg text-muted hover:text-accent hover:bg-surface"><ExternalLink className="size-4" /></a>}
                      <JobRowMenu job={j} />
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile / tablet list */}
      <ul className="lg:hidden divide-y divide-line">
        {rows.map((j) => (
          <li key={j.id} onClick={() => openJob(j.id)} className="px-4 py-3.5 active:bg-raised cursor-pointer">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="font-medium leading-snug">{j.title}</div>
                <div className="text-sm text-muted">{j.company}</div>
              </div>
              <JobRowMenu job={j} />
            </div>
            <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted"><MapPin className="size-3" />{locationLine(j)}</div>
            <div className="mt-2.5 flex flex-wrap items-center gap-1.5">
              <MatchRibbon match={j.match} />
              <SponsorshipBadge category={j.sponsorship.category} />
              <VerificationBadge status={j.verification.status} note={j.verification.note} />
              <FreshnessBadge job={j} />
              {showStatus && j.status !== 'Discovered' && <StatusBadge status={j.status} />}
            </div>
          </li>
        ))}
      </ul>

      {sorted.length > shown && (
        <div className="p-3 border-t border-line text-center">
          <button className="text-sm text-accent hover:underline" onClick={() => setShown((s) => s + pageSize)}>Show {Math.min(pageSize, sorted.length - shown)} more of {sorted.length - shown}</button>
        </div>
      )}
    </div>
  );
}
