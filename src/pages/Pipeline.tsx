import { useMemo, useState } from 'react';
import clsx from 'clsx';
import { CalendarClock, GripVertical } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useUI } from '@/context/UIContext';
import { PageHeader, Select } from '@/components/ui';
import { useJobActions } from '@/components/jobs/useJobActions';
import type { ApplicationStatus } from '@shared/types';
import { fmtDate, relDays } from '@/lib/format';

const COLUMNS: ApplicationStatus[] = ['Applied', 'Assessment', 'Interview Scheduled', 'Interview Completed', 'Offer Received'];

export function Pipeline() {
  const { jobs, appsByJob } = useData();
  const { openJob } = useUI();
  const a = useJobActions();
  const [over, setOver] = useState<ApplicationStatus | null>(null);
  const cols = useMemo(() => COLUMNS.map((c) => ({ status: c, jobs: jobs.filter((j) => j.status === c).sort((x, y) => (appsByJob.get(y.id)?.appliedDate ?? '').localeCompare(appsByJob.get(x.id)?.appliedDate ?? '')) })), [jobs, appsByJob]);

  return (
    <div>
      <PageHeader title="Interview pipeline" description="Drag a card to move it to a new stage, or use the stage menu on the card. Status only changes when you change it." />
      <div className="flex gap-4 overflow-x-auto pb-4 -mx-4 px-4 lg:mx-0 lg:px-0 snap-x">
        {cols.map((col) => (
          <section key={col.status} aria-label={col.status}
            onDragOver={(e) => { e.preventDefault(); setOver(col.status); }} onDragLeave={() => setOver(null)}
            onDrop={(e) => { e.preventDefault(); setOver(null); const id = e.dataTransfer.getData('text/job'); const job = jobs.find((j) => j.id === id); if (job && job.status !== col.status) a.setStatus(job, col.status); }}
            className={clsx('w-72 shrink-0 snap-start rounded-xl border bg-raised/60 transition-colors', over === col.status ? 'border-accent bg-accent-soft/40' : 'border-line')}>
            <header className="flex items-center justify-between px-3 h-11">
              <h2 className="text-[0.8125rem] font-semibold">{col.status}</h2>
              <span className="num text-xs text-muted">{col.jobs.length}</span>
            </header>
            <ul className="px-2 pb-2 space-y-2 min-h-[8rem]">
              {col.jobs.map((j) => {
                const app = appsByJob.get(j.id);
                return (
                  <li key={j.id} draggable onDragStart={(e) => e.dataTransfer.setData('text/job', j.id)}
                    className="group rounded-lg border border-line bg-surface p-3 cursor-grab active:cursor-grabbing hover:border-faint/60">
                    <div className="flex gap-2">
                      <GripVertical className="size-4 text-faint shrink-0 mt-0.5 opacity-0 group-hover:opacity-100" />
                      <button className="min-w-0 text-left flex-1" onClick={() => openJob(j.id, 'application')}>
                        <div className="text-sm font-medium leading-snug">{j.title}</div>
                        <div className="text-xs text-muted mt-0.5">{j.company}</div>
                      </button>
                    </div>
                    <div className="mt-2.5 space-y-1 text-xs text-muted pl-6">
                      {app && <div>Applied {relDays(app.appliedDate)}</div>}
                      {app?.interviewDate && <div className="flex items-center gap-1 text-ink"><CalendarClock className="size-3.5 text-accent" />Interview {fmtDate(app.interviewDate)}</div>}
                    </div>
                    <div className="mt-2.5 pl-6">
                      <Select aria-label="Move to stage" className="h-7 text-xs" value={j.status} onChange={(e) => a.setStatus(j, e.target.value as ApplicationStatus)}>
                        {[...COLUMNS, 'Rejected', 'Withdrawn'].map((s) => <option key={s}>{s}</option>)}
                      </Select>
                    </div>
                  </li>
                );
              })}
              {!col.jobs.length && <li className="text-xs text-faint text-center py-8">Drop a card here</li>}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
