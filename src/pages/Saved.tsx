import { useMemo, useState } from 'react';
import { Bookmark } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { PageHeader, Empty, Tabs } from '@/components/ui';
import { JobTable } from '@/components/jobs/JobTable';

const STATES = ['Shortlisted', 'Saved', 'Ready to Apply'] as const;

export function Saved() {
  const { jobs } = useData();
  const [tab, setTab] = useState<'all' | (typeof STATES)[number]>('all');
  const saved = useMemo(() => jobs.filter((j) => (STATES as readonly string[]).includes(j.status)), [jobs]);
  const rows = tab === 'all' ? saved : saved.filter((j) => j.status === tab);
  const closed = saved.filter((j) => j.verification.status === 'Closed').length;
  return (
    <div>
      <PageHeader title="Saved jobs" description={`Shortlisted, saved and ready-to-apply vacancies. These are rechecked on every refresh${closed ? ` — ${closed} have since closed` : ''}.`} />
      <div className="panel overflow-hidden">
        <div className="px-4"><Tabs value={tab} onChange={setTab} items={[{ id: 'all', label: `All (${saved.length})` }, ...STATES.map((s) => ({ id: s, label: `${s} (${saved.filter((j) => j.status === s).length})` }))]} /></div>
        <JobTable jobs={rows} showStatus initialSort={['match', 'desc']} empty={<Empty icon={<Bookmark className="size-6" />} title="Nothing saved yet">Save vacancies from Discover or Recommended to build your shortlist.</Empty>} />
      </div>
    </div>
  );
}
