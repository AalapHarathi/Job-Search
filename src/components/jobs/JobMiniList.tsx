import type { Job } from '@shared/types';
import { useUI } from '@/context/UIContext';
import { MatchRibbon } from './MatchRibbon';
import { SponsorshipBadge, VerificationBadge } from './badges';
import { relDays } from '@/lib/format';
import { locationLine } from './JobTable';
import type { ReactNode } from 'react';

export function JobMiniList({ jobs, empty, right }: { jobs: Job[]; empty: ReactNode; right?: (j: Job) => ReactNode }) {
  const { openJob } = useUI();
  if (!jobs.length) return <>{empty}</>;
  return (
    <ul className="divide-y divide-line">
      {jobs.map((j) => (
        <li key={j.id}>
          <button onClick={() => openJob(j.id)} className="w-full text-left px-4 py-3 hover:bg-raised/70 flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <div className="text-sm font-medium truncate">{j.title}</div>
              <div className="text-xs text-muted truncate mt-0.5">{j.company} — {locationLine(j)}</div>
            </div>
            <div className="hidden sm:flex items-center gap-1.5 shrink-0">
              {right ? right(j) : <><SponsorshipBadge category={j.sponsorship.category} /><VerificationBadge status={j.verification.status} note={j.verification.note} /><span className="text-xs text-faint w-16 text-right">{relDays(j.postedAt ?? j.firstSeenAt)}</span></>}
            </div>
            <div className="shrink-0"><MatchRibbon match={j.match} /></div>
          </button>
        </li>
      ))}
    </ul>
  );
}
