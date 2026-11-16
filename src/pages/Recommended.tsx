import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Sparkles, ExternalLink } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useUI } from '@/context/UIContext';
import { PageHeader, Empty, Button } from '@/components/ui';
import { MatchRibbon } from '@/components/jobs/MatchRibbon';
import { FreshnessBadge, SponsorshipBadge, VerificationBadge } from '@/components/jobs/badges';
import { recommended, whyRecommended } from '@/lib/jobQueries';
import { locationLine } from '@/components/jobs/JobTable';
import { fmtSalary, safeUrl } from '@/lib/format';
import { useJobActions } from '@/components/jobs/useJobActions';

export function Recommended() {
  const { jobs, prefs, resumes } = useData();
  const { openJob } = useUI();
  const a = useJobActions();
  const rec = useMemo(() => recommended(jobs, prefs), [jobs, prefs]);
  return (
    <div>
      <PageHeader title="Recommended for me" description={`Open vacancies scoring ${prefs.minRecommendedScore}+ where sponsorship doesn’t rule you out. Ranked by match, then freshness, sponsorship and deadline.`}
        actions={<Link to="/preferences" className="text-sm text-accent hover:underline">Change threshold</Link>} />
      {!rec.length ? (
        <div className="panel"><Empty icon={<Sparkles className="size-6" />} title="No recommendations right now">
          {resumes.length ? 'Nothing currently meets your threshold. Add more employer boards in Search preferences or lower the minimum score.' : <>Upload your resume in <Link className="link" to="/resume">Resume intelligence</Link> to get scored recommendations.</>}
        </Empty></div>
      ) : (
        <ol className="space-y-3">
          {rec.map((j, i) => {
            const an = j.match!.aiAnalysis ?? j.match!.analysis;
            const apply = safeUrl(j.applicationUrl);
            return (
              <li key={j.id} className="panel p-4 sm:p-5">
                <div className="flex flex-col md:flex-row md:items-start gap-4">
                  <span className="num text-sm text-faint w-6 shrink-0 hidden md:block pt-0.5">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <button onClick={() => openJob(j.id)} className="text-left">
                      <h3 className="font-semibold leading-snug hover:text-accent">{j.title}</h3>
                      <p className="text-sm text-muted mt-0.5">{j.company} — {locationLine(j)}{j.salary ? ` — ${fmtSalary(j.salary)}` : ''}</p>
                    </button>
                    <div className="mt-2.5 flex flex-wrap gap-1.5"><SponsorshipBadge category={j.sponsorship.category} /><VerificationBadge status={j.verification.status} note={j.verification.note} /><FreshnessBadge job={j} /></div>
                    <ul className="mt-3 space-y-1">
                      {whyRecommended(j, prefs).map((w, k) => <li key={k} className="text-sm text-ink/85 flex gap-2"><span className="mt-2 size-1 rounded-full bg-accent shrink-0" />{w}</li>)}
                    </ul>
                    {an.rejectionRisks[0] && !an.rejectionRisks[0].startsWith('No major') && <p className="text-xs text-warn mt-2">Watch out: {an.rejectionRisks[0]}</p>}
                  </div>
                  <div className="md:w-56 shrink-0 space-y-3">
                    <MatchRibbon match={j.match} />
                    <div className="flex flex-wrap gap-2">
                      {apply ? <a href={apply} target="_blank" rel="noopener noreferrer" className="inline-flex h-7 items-center gap-1 rounded-lg bg-accent px-2.5 text-[0.8125rem] font-medium text-white dark:text-[#0f1115] hover:bg-accent/90"><ExternalLink className="size-3.5" />Apply</a> : null}
                      <Button size="sm" onClick={() => a.toggleSave(j)}>{j.status === 'Saved' ? 'Saved' : 'Save'}</Button>
                      <Button size="sm" variant="ghost" onClick={() => openJob(j.id, 'match')}>Analysis</Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })}
        </ol>
      )}
    </div>
  );
}
