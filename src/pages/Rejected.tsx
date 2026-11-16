import { useMemo, useState } from 'react';
import { useData } from '@/context/DataContext';
import { PageHeader, Empty, Tabs } from '@/components/ui';
import { JobTable } from '@/components/jobs/JobTable';

type T = 'Rejected' | 'Withdrawn' | 'Not Interested' | 'Closed';

export function Rejected() {
  const { jobs, appsByJob } = useData();
  const [tab, setTab] = useState<T>('Rejected');
  const groups = useMemo(() => ({
    Rejected: jobs.filter((j) => j.status === 'Rejected'),
    Withdrawn: jobs.filter((j) => j.status === 'Withdrawn'),
    'Not Interested': jobs.filter((j) => j.status === 'Not Interested'),
    // Closed vacancies you'd engaged with: history is kept even after the listing goes.
    Closed: jobs.filter((j) => j.verification.status === 'Closed' && (j.status !== 'Discovered' || appsByJob.has(j.id))),
  }), [jobs, appsByJob]);
  return (
    <div>
      <PageHeader title="Rejected & closed" description="Outcomes you’ve recorded, vacancies you passed on, and closed listings you’d engaged with. Nothing here is deleted." />
      <div className="panel overflow-hidden">
        <div className="px-4"><Tabs<T> value={tab} onChange={setTab} items={(Object.keys(groups) as T[]).map((k) => ({ id: k, label: `${k} (${groups[k].length})` }))} /></div>
        <JobTable jobs={groups[tab]} showStatus initialSort={['posted', 'desc']} empty={<Empty title={`No ${tab.toLowerCase()} jobs`} />} />
      </div>
    </div>
  );
}
