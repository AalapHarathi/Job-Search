import { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, ArrowUpRight, CalendarClock, CircleCheck, FileUp, RefreshCw, Sparkles, Clock, Bookmark } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useUI } from '@/context/UIContext';
import { useAuth } from '@/context/AuthContext';
import { PageHeader, Section, Empty } from '@/components/ui';
import { JobMiniList } from '@/components/jobs/JobMiniList';
import { RefreshPanel } from '@/components/layout/RefreshStatus';
import { AreaTrend, HBars } from '@/components/charts/Charts';
import { isOpen, recommended } from '@/lib/jobQueries';
import { daysUntil, fmtDate, pct, relDays } from '@/lib/format';
import { INTERVIEW_STATUSES, PENDING_STATUSES, SUBMITTED_STATUSES, type Job } from '@shared/types';
import { ageDays } from '@shared/freshness';
import { StatusBadge } from '@/components/jobs/badges';

const SAVEDISH = ['Saved', 'Shortlisted', 'Ready to Apply'];

export function Overview() {
  const { jobs, applications, prefs, resumes, refresh, jobsById } = useData();
  const { user } = useAuth();
  const { openJob } = useUI();

  const m = useMemo(() => {
    const open = jobs.filter(isOpen);
    const rec = recommended(jobs, prefs);
    const appJobs = applications.map((a) => ({ a, j: jobsById.get(a.jobId) }));
    const deadlines: { id: string; when: string; label: string; detail: string; jobId: string; kind: 'closing' | 'follow' | 'interview' }[] = [];
    for (const j of open) {
      if (!SAVEDISH.includes(j.status) && j.status !== 'Discovered') continue;
      const d = daysUntil(j.closingDate);
      if (d !== null && d >= 0 && d <= 14) deadlines.push({ id: 'c' + j.id, when: j.closingDate!, label: `Closes: ${j.title}`, detail: j.company, jobId: j.id, kind: 'closing' });
    }
    for (const { a, j } of appJobs) {
      const live = !j || !['Rejected', 'Withdrawn', 'Not Interested', 'Offer Received'].includes(j.status);
      const f = daysUntil(a.nextFollowUp);
      if (live && a.nextFollowUp && f !== null && f <= 7) deadlines.push({ id: 'f' + a.jobId, when: a.nextFollowUp, label: `Follow up: ${a.company}`, detail: a.title, jobId: a.jobId, kind: 'follow' });
      const iv = daysUntil(a.interviewDate);
      if (a.interviewDate && iv !== null && iv >= 0 && iv <= 14) deadlines.push({ id: 'i' + a.jobId, when: a.interviewDate, label: `Interview: ${a.company}`, detail: a.title, jobId: a.jobId, kind: 'interview' });
    }
    deadlines.sort((x, y) => x.when.localeCompare(y.when));

    const days = 30;
    const activity = Array.from({ length: days }, (_, i) => {
      const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (days - 1 - i));
      return { key: d.toISOString().slice(0, 10), name: d.toLocaleDateString(undefined, { day: 'numeric', month: 'short' }), found: 0 };
    });
    const idx = new Map(activity.map((a, i) => [a.key, i]));
    for (const j of jobs) {
      const k = new Date(j.firstSeenAt); k.setHours(0, 0, 0, 0);
      const i = idx.get(new Date(k.getTime() - k.getTimezoneOffset() * 60000).toISOString().slice(0, 10));
      if (i !== undefined) activity[i].found++;
    }

    const statusOrder = ['Shortlisted', 'Saved', 'Ready to Apply', 'Applied', 'Assessment', 'Interview Scheduled', 'Interview Completed', 'Offer Received', 'Rejected', 'Withdrawn'];
    const pipeline = statusOrder.map((s) => ({ name: s, value: jobs.filter((j) => j.status === s).length })).filter((x) => x.value > 0);

    const submitted = jobs.filter((j) => SUBMITTED_STATUSES.includes(j.status));
    const reachedInterview = jobs.filter((j) => INTERVIEW_STATUSES.includes(j.status) || applicationsHadInterview(applications.find((a) => a.jobId === j.id)?.history));
    return {
      open, rec,
      kpis: [
        { label: 'Jobs discovered', value: jobs.length, to: '/discover' },
        { label: 'New this week', value: jobs.filter((j) => (ageDays(j.firstSeenAt) ?? 99) < 7).length, to: '/discover' },
        { label: 'Excellent matches', value: open.filter((j) => (j.match?.score ?? 0) >= 90).length, to: '/recommended' },
        { label: 'Jobs saved', value: jobs.filter((j) => SAVEDISH.includes(j.status)).length, to: '/saved' },
        { label: 'Applications submitted', value: applications.length, to: '/applied' },
        { label: 'Interviews scheduled', value: jobs.filter((j) => j.status === 'Interview Scheduled').length, to: '/pipeline' },
        { label: 'Applications pending', value: jobs.filter((j) => PENDING_STATUSES.includes(j.status)).length, to: '/applied' },
        { label: 'Upcoming deadlines', value: deadlines.length, to: undefined },
      ],
      deadlines, activity, pipeline,
      recent: [...open].sort((a, b) => b.firstSeenAt.localeCompare(a.firstSeenAt) || (b.match?.score ?? 0) - (a.match?.score ?? 0)).slice(0, 6),
      recentApplied: [...applications].sort((a, b) => b.appliedDate.localeCompare(a.appliedDate)).slice(0, 6),
      rates: {
        submitted: submitted.length,
        interviewRate: pct(reachedInterview.length, submitted.length),
        offerRate: pct(jobs.filter((j) => j.status === 'Offer Received').length, submitted.length),
        rejectionRate: pct(jobs.filter((j) => j.status === 'Rejected').length, submitted.length),
        avgMatch: applications.filter((a) => a.matchScore != null).length ? Math.round(applications.reduce((s, a) => s + (a.matchScore ?? 0), 0) / applications.filter((a) => a.matchScore != null).length) : null,
      },
    };
  }, [jobs, applications, prefs, jobsById]);

  const actions = useMemo(() => buildActions({ jobs, resumes: resumes.length, refresh, applications, rec: m.rec }), [jobs, resumes.length, refresh, applications, m.rec]);
  const firstName = (user?.displayName ?? '').split(' ')[0];

  return (
    <div className="space-y-6">
      <PageHeader title={firstName ? `Good ${greeting()}, ${firstName}` : 'Overview'} description={`${m.open.length} open vacancies tracked across ${new Set(m.open.map((j) => j.company)).size} companies.`} />

      <div className="rounded-xl border border-line overflow-hidden grid grid-cols-2 sm:grid-cols-4 xl:grid-cols-8 gap-px bg-line">
        {m.kpis.map((k) => {
          const inner = (
            <>
              <div className="text-xs text-muted leading-tight">{k.label}</div>
              <div className="num text-2xl font-semibold tracking-[-0.02em] mt-2">{k.value}</div>
            </>
          );
          return k.to
            ? <Link key={k.label} to={k.to} className="bg-surface p-4 hover:bg-raised transition-colors">{inner}</Link>
            : <div key={k.label} className="bg-surface p-4">{inner}</div>;
        })}
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <Section title="Top 10 recommended" className="xl:col-span-2" bodyClass="" action={<Link to="/recommended" className="text-xs text-accent hover:underline inline-flex items-center gap-0.5">All recommendations<ArrowUpRight className="size-3" /></Link>}>
          <JobMiniList jobs={m.rec.slice(0, 10)} empty={<Empty icon={<Sparkles className="size-6" />} title="No recommendations yet">{resumes.length ? `Nothing currently scores ${prefs.minRecommendedScore}+ with workable sponsorship. Lower the threshold in Search preferences or add more company boards.` : 'Upload your resume so vacancies can be scored.'}</Empty>} />
        </Section>
        <div className="space-y-6">
          <Section title="Recommended actions" bodyClass="">
            {actions.length ? (
              <ul className="divide-y divide-line">
                {actions.map((a, i) => (
                  <li key={i}>
                    <Link to={a.to} className="flex gap-3 px-4 py-3 hover:bg-raised/70">
                      <span className={a.tone === 'bad' ? 'text-bad' : a.tone === 'warn' ? 'text-warn' : 'text-accent'}>{a.icon}</span>
                      <span className="min-w-0"><span className="block text-sm font-medium">{a.title}</span><span className="block text-xs text-muted mt-0.5">{a.detail}</span></span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : <Empty icon={<CircleCheck className="size-6" />} title="Nothing needs attention" />}
          </Section>
          <Section title="Job refresh"><RefreshPanel /></Section>
        </div>
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <Section title="Recent opportunities" className="xl:col-span-2" bodyClass="" action={<Link to="/discover" className="text-xs text-accent hover:underline inline-flex items-center gap-0.5">Discover<ArrowUpRight className="size-3" /></Link>}>
          <JobMiniList jobs={m.recent} empty={<Empty title="No vacancies yet">Your first scheduled refresh will populate this list.</Empty>} />
        </Section>
        <Section title="Upcoming deadlines" bodyClass="">
          {m.deadlines.length ? (
            <ul className="divide-y divide-line">
              {m.deadlines.slice(0, 8).map((d) => {
                const n = daysUntil(d.when)!;
                return (
                  <li key={d.id}>
                    <button onClick={() => openJob(d.jobId, d.kind === 'closing' ? 'overview' : 'application')} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-raised/70">
                      <span className={n < 0 ? 'text-bad' : n <= 2 ? 'text-warn' : 'text-muted'}>{d.kind === 'interview' ? <CalendarClock className="size-4" /> : d.kind === 'follow' ? <Clock className="size-4" /> : <AlertTriangle className="size-4" />}</span>
                      <span className="min-w-0 flex-1"><span className="block text-sm truncate">{d.label}</span><span className="block text-xs text-muted truncate">{d.detail}</span></span>
                      <span className={`text-xs num whitespace-nowrap ${n < 0 ? 'text-bad' : 'text-muted'}`}>{n < 0 ? `${-n}d overdue` : n === 0 ? 'Today' : `in ${n}d`}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="No deadlines in the next two weeks" />}
        </Section>
      </div>

      <div className="grid xl:grid-cols-2 gap-6">
        <Section title="Job discovery activity" action={<span className="text-xs text-muted">New vacancies per day, last 30 days</span>}>
          {jobs.length ? <AreaTrend data={m.activity} dataKey="found" label="New vacancies" /> : <Empty title="No discovery runs yet" />}
        </Section>
        <Section title="Application pipeline">
          {m.pipeline.length ? <HBars data={m.pipeline} /> : <Empty title="Nothing in your pipeline yet">Save or apply to a job to start tracking it.</Empty>}
        </Section>
      </div>

      <div className="grid xl:grid-cols-3 gap-6">
        <Section title="Application success">
          <dl className="grid grid-cols-2 gap-4">
            {[
              ['Submitted', String(m.rates.submitted)],
              ['Reached interview', m.rates.interviewRate],
              ['Offers', m.rates.offerRate],
              ['Rejection rate', m.rates.rejectionRate],
              ['Avg. match when applying', m.rates.avgMatch != null ? String(m.rates.avgMatch) : '—'],
            ].map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="num text-xl font-semibold mt-1">{v}</dd></div>)}
          </dl>
          <Link to="/analytics" className="mt-4 inline-flex text-xs text-accent hover:underline items-center gap-0.5">Full analytics<ArrowUpRight className="size-3" /></Link>
        </Section>
        <Section title="Recently applied" className="xl:col-span-2" bodyClass="">
          {m.recentApplied.length ? (
            <ul className="divide-y divide-line">
              {m.recentApplied.map((a) => {
                const j = jobsById.get(a.jobId);
                return (
                  <li key={a.jobId}>
                    <button onClick={() => openJob(a.jobId, 'application')} className="w-full text-left flex items-center gap-3 px-4 py-3 hover:bg-raised/70">
                      <span className="min-w-0 flex-1"><span className="block text-sm font-medium truncate">{a.title}</span><span className="block text-xs text-muted truncate">{a.company} — applied {fmtDate(a.appliedDate)} ({relDays(a.appliedDate)})</span></span>
                      {j && <StatusBadge status={j.status} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : <Empty title="No applications yet">Apply on the employer’s site, then use “Mark applied” to track it here.</Empty>}
        </Section>
      </div>
    </div>
  );
}

function greeting() { const h = new Date().getHours(); return h < 12 ? 'morning' : h < 17 ? 'afternoon' : 'evening'; }

function applicationsHadInterview(h?: { status: string }[]) { return !!h?.some((x) => x.status.startsWith('Interview') || x.status === 'Offer Received'); }

function buildActions({ jobs, resumes, refresh, applications, rec }: { jobs: Job[]; resumes: number; refresh: ReturnType<typeof useData>['refresh']; applications: ReturnType<typeof useData>['applications']; rec: Job[] }) {
  const out: { title: string; detail: string; to: string; icon: JSX.Element; tone?: 'warn' | 'bad' }[] = [];
  if (!resumes) out.push({ title: 'Upload your resume', detail: 'Scores, analysis and recommendations all depend on it.', to: '/resume', icon: <FileUp className="size-4" /> });
  if (!refresh?.lastSuccessAt && refresh?.lastStatus !== 'failed') out.push({ title: 'Run your first job refresh', detail: 'Add the GitHub secrets in DEPLOYMENT.md, then run “Refresh jobs”.', to: '/settings', icon: <RefreshCw className="size-4" /> });
  if (refresh?.lastStatus === 'failed') out.push({ title: 'The last refresh failed', detail: refresh.lastError?.split('\n')[0] ?? 'See details on this page.', to: '/settings', icon: <AlertTriangle className="size-4" />, tone: 'bad' });
  const due = applications.filter((a) => { const d = daysUntil(a.nextFollowUp); const j = jobs.find((x) => x.id === a.jobId); return d !== null && d <= 0 && (!j || PENDING_STATUSES.includes(j.status)); });
  if (due.length) out.push({ title: `${due.length} follow-up${due.length > 1 ? 's' : ''} due`, detail: due.slice(0, 2).map((a) => a.company).join(', ') + (due.length > 2 ? '…' : ''), to: '/applied', icon: <Clock className="size-4" />, tone: 'warn' });
  const closing = jobs.filter((j) => isOpen(j) && SAVEDISH.includes(j.status) && (daysUntil(j.closingDate) ?? 99) <= 3);
  if (closing.length) out.push({ title: `${closing.length} saved job${closing.length > 1 ? 's' : ''} closing within 3 days`, detail: closing[0].title, to: '/saved', icon: <AlertTriangle className="size-4" />, tone: 'warn' });
  const fresh = rec.filter((j) => j.status === 'Discovered' && (j.match?.score ?? 0) >= 85);
  if (fresh.length) out.push({ title: `Review ${fresh.length} strong new match${fresh.length > 1 ? 'es' : ''}`, detail: `Best: ${fresh[0].title} at ${fresh[0].company}`, to: '/recommended', icon: <Sparkles className="size-4" /> });
  const goneSaved = jobs.filter((j) => SAVEDISH.includes(j.status) && j.verification.status === 'Closed');
  if (goneSaved.length) out.push({ title: `${goneSaved.length} saved job${goneSaved.length > 1 ? 's are' : ' is'} no longer open`, detail: 'Move them to Not interested to tidy your list.', to: '/saved', icon: <Bookmark className="size-4" />, tone: 'warn' });
  const noFollow = applications.filter((a) => !a.nextFollowUp && (() => { const j = jobs.find((x) => x.id === a.jobId); return !j || j.status === 'Applied'; })());
  if (noFollow.length) out.push({ title: `Set follow-up dates for ${noFollow.length} application${noFollow.length > 1 ? 's' : ''}`, detail: 'A dated reminder keeps applications from going quiet.', to: '/applied', icon: <CalendarClock className="size-4" /> });
  if (resumes && jobs.some((j) => !j.match)) out.push({ title: 'Some vacancies aren’t scored', detail: 'Re-score them from Resume intelligence.', to: '/resume', icon: <Sparkles className="size-4" /> });
  return out.slice(0, 6);
}

