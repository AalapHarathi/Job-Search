import { useMemo, useState } from 'react';
import { BarChart3 } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useUI } from '@/context/UIContext';
import { PageHeader, Section, Empty, Tabs } from '@/components/ui';
import { HBars, VBars } from '@/components/charts/Charts';
import { StatusBadge } from '@/components/jobs/badges';
import { COUNTRY_NAMES } from '@shared/geo';
import { titleCategory } from '@shared/titles';
import { INTERVIEW_STATUSES, type ApplicationStatus } from '@shared/types';
import { fmtDate, pct } from '@/lib/format';

function countBy<T>(arr: T[], key: (t: T) => string, top = 12) {
  const m = new Map<string, number>();
  arr.forEach((x) => m.set(key(x), (m.get(key(x)) ?? 0) + 1));
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, top);
}

function weekKey(iso: string) {
  const d = new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
  const day = (d.getDay() + 6) % 7;
  d.setDate(d.getDate() - day);
  return d.toISOString().slice(0, 10);
}

export function Analytics() {
  const { applications, jobsById, jobs } = useData();
  const { openJob } = useUI();
  const [period, setPeriod] = useState<'week' | 'month'>('week');

  const a = useMemo(() => {
    const rows = applications.map((app) => ({ app, job: jobsById.get(app.jobId) }));
    const status = (r: (typeof rows)[number]) => r.job?.status ?? 'Applied';
    const everInterview = (r: (typeof rows)[number]) => INTERVIEW_STATUSES.includes(status(r) as ApplicationStatus) || r.app.history.some((h) => INTERVIEW_STATUSES.includes(h.status));
    const interviewed = rows.filter(everInterview);
    const offers = rows.filter((r) => status(r) === 'Offer Received' || r.app.history.some((h) => h.status === 'Offer Received'));
    const rejected = rows.filter((r) => status(r) === 'Rejected');
    const savedNow = jobs.filter((j) => ['Saved', 'Shortlisted', 'Ready to Apply'].includes(j.status)).length;
    const scored = rows.filter((r) => r.app.matchScore != null);

    const buckets = new Map<string, { applied: number; interviews: number; rejected: number }>();
    const keyOf = (iso: string) => (period === 'week' ? weekKey(iso) : iso.slice(0, 7));
    const n = period === 'week' ? 12 : 12;
    for (let i = n - 1; i >= 0; i--) {
      const d = new Date();
      if (period === 'week') d.setDate(d.getDate() - i * 7); else { d.setDate(1); d.setMonth(d.getMonth() - i); }
      buckets.set(keyOf(d.toISOString().slice(0, 10)), { applied: 0, interviews: 0, rejected: 0 });
    }
    rows.forEach((r) => {
      const b = buckets.get(keyOf(r.app.appliedDate));
      if (!b) return;
      b.applied++;
      if (everInterview(r)) b.interviews++;
      if (status(r) === 'Rejected') b.rejected++;
    });
    const timeSeries = [...buckets.entries()].map(([k, v]) => ({
      name: period === 'week' ? new Date(k + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'short' }) : new Date(k + '-01T00:00:00').toLocaleDateString(undefined, { month: 'short', year: '2-digit' }),
      Applied: v.applied - v.interviews - v.rejected > 0 ? v.applied - v.interviews - v.rejected : 0,
      Interview: v.interviews, Rejected: v.rejected,
    }));

    const pipeline = countBy(rows, (r) => status(r), 20);
    const timeline = rows.flatMap((r) => r.app.history.map((h) => ({ ...h, title: r.app.title, company: r.app.company, jobId: r.app.jobId }))).sort((x, y) => y.at.localeCompare(x.at));

    return {
      total: rows.length,
      byCountry: countBy(rows, (r) => (r.app.country ? COUNTRY_NAMES[r.app.country] ?? r.app.country : 'Remote / unspecified')),
      byCategory: countBy(rows, (r) => titleCategory(r.app.title)),
      byCompany: countBy(rows, (r) => r.app.company, 10),
      timeSeries, pipeline, timeline,
      rates: [
        { label: 'Save → apply conversion', value: pct(rows.length, rows.length + savedNow), hint: 'Applications ÷ (applications + jobs still saved)' },
        { label: 'Interview conversion', value: pct(interviewed.length, rows.length), hint: 'Applications that reached an interview' },
        { label: 'Interview success', value: pct(offers.length, interviewed.length), hint: 'Offers ÷ applications that reached interview' },
        { label: 'Rejection rate', value: pct(rejected.length, rows.length), hint: 'Rejected ÷ all applications' },
        { label: 'Average match when applying', value: scored.length ? String(Math.round(scored.reduce((s, r) => s + (r.app.matchScore ?? 0), 0) / scored.length)) : '—', hint: 'Score at the moment you recorded the application' },
        { label: 'Applications', value: String(rows.length), hint: `${offers.length} offer${offers.length === 1 ? '' : 's'} so far` },
      ],
    };
  }, [applications, jobsById, jobs, period]);

  if (!a.total) return (
    <div><PageHeader title="Analytics" /><div className="panel"><Empty icon={<BarChart3 className="size-6" />} title="Analytics start with your first application">Every chart here is calculated from applications you record. Mark a job as applied to begin.</Empty></div></div>
  );

  return (
    <div className="space-y-6">
      <PageHeader title="Analytics" description={`Calculated from ${a.total} recorded application${a.total === 1 ? '' : 's'} in Firestore.`} />
      <div className="rounded-xl border border-line overflow-hidden grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-px bg-line">
        {a.rates.map((r) => <div key={r.label} className="bg-surface p-4" title={r.hint}><div className="text-xs text-muted">{r.label}</div><div className="num text-2xl font-semibold mt-2 tracking-[-0.02em]">{r.value}</div><div className="text-2xs text-faint mt-1">{r.hint}</div></div>)}
      </div>

      <Section title="Applications over time" action={<div className="-my-2"><Tabs value={period} onChange={setPeriod} items={[{ id: 'week', label: 'Weekly' }, { id: 'month', label: 'Monthly' }]} /></div>}>
        <VBars data={a.timeSeries} height={240} series={[{ key: 'Applied', label: 'Awaiting / other', color: 'accent' }, { key: 'Interview', label: 'Reached interview', color: 'good' }, { key: 'Rejected', label: 'Rejected', color: 'bad' }]} />
      </Section>

      <div className="grid xl:grid-cols-2 gap-6">
        <Section title="Pipeline distribution"><HBars data={a.pipeline} /></Section>
        <Section title="By country"><HBars data={a.byCountry} /></Section>
        <Section title="By job category"><HBars data={a.byCategory} /></Section>
        <Section title="By company"><HBars data={a.byCompany} /></Section>
      </div>

      <Section title="Application history" bodyClass="">
        <ol className="divide-y divide-line max-h-[32rem] overflow-y-auto">
          {a.timeline.map((t, i) => (
            <li key={i}>
              <button className="w-full text-left flex items-center gap-4 px-4 py-2.5 hover:bg-raised/70" onClick={() => openJob(t.jobId, 'application')}>
                <span className="text-xs text-muted w-28 shrink-0 num">{fmtDate(t.at)}</span>
                <StatusBadge status={t.status} />
                <span className="text-sm truncate">{t.title} <span className="text-muted">at {t.company}</span></span>
              </button>
            </li>
          ))}
        </ol>
      </Section>
    </div>
  );
}
