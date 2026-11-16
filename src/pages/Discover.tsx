import { useMemo, useState } from 'react';
import { Compass } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { PageHeader, Empty } from '@/components/ui';
import { JobFilters } from '@/components/jobs/JobFilters';
import { JobTable } from '@/components/jobs/JobTable';
import { applyFilters, defaultFilters, type JobFilters as F } from '@/lib/jobQueries';
import { fmtDateTimeRel } from '@/lib/format';

export function Discover() {
  const { jobs, prefs, refresh } = useData();
  const [filters, setFilters] = useState<F>(defaultFilters);
  const rows = useMemo(() => applyFilters(jobs, filters, prefs), [jobs, filters, prefs]);
  const verified = rows.filter((j) => j.verification.status === 'Verified').length;
  return (
    <div>
      <PageHeader
        title="Discover jobs"
        description={<>{rows.length} vacancies match these filters — {verified} confirmed on the employer’s own site. {refresh?.lastSuccessAt ? `Last refreshed ${fmtDateTimeRel(refresh.lastSuccessAt)}.` : ''}</>}
      />
      <div className="mb-4"><JobFilters value={filters} onChange={setFilters} jobs={jobs} /></div>
      <div className="panel overflow-hidden">
        <JobTable jobs={rows} showStatus initialSort={['match', 'desc']} empty={
          <Empty icon={<Compass className="size-6" />} title={jobs.length ? 'No vacancies match these filters' : 'No vacancies discovered yet'}>
            {jobs.length
              ? 'Try widening the posting window or clearing filters. Vacancies older than 30 days only appear when verified and “Include older vacancies” is on.'
              : 'Once the refresh workflow is configured, verified openings from your tracked company boards and job APIs appear here. See DEPLOYMENT.md for the secrets it needs.'}
          </Empty>
        } />
      </div>
    </div>
  );
}
