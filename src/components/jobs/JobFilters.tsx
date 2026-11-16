import { RotateCcw, Search, SlidersHorizontal } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import type { Job } from '@shared/types';
import { SPONSORSHIP_LABELS } from '@shared/types';
import { COUNTRY_NAMES } from '@shared/geo';
import { defaultFilters, type JobFilters as F } from '@/lib/jobQueries';
import { Select, Button } from '@/components/ui';

export function JobFilters({ value, onChange, jobs }: { value: F; onChange: (f: F) => void; jobs: Job[] }) {
  const [more, setMore] = useState(false);
  const set = <K extends keyof F>(k: K, v: F[K]) => onChange({ ...value, [k]: v });
  const countries = [...new Set(jobs.map((j) => j.country ?? 'REMOTE'))].sort();
  const companies = [...new Set(jobs.map((j) => j.company))].sort((a, b) => a.localeCompare(b));
  const types = [...new Set(jobs.map((j) => j.employmentType).filter(Boolean) as string[])].slice(0, 30);
  const dirty = JSON.stringify(value) !== JSON.stringify(defaultFilters());

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <div className="relative flex-1 min-w-[14rem]">
          <Search className="size-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
          <input className="input pl-9" placeholder="Search title, company or location" value={value.q} onChange={(e) => set('q', e.target.value)} aria-label="Search jobs" />
        </div>
        <Select className="w-auto" aria-label="Posted within" value={value.postedWithin} onChange={(e) => set('postedWithin', Number(e.target.value))}>
          <option value={3}>Posted ≤ 3 days</option>
          <option value={7}>Posted ≤ 7 days</option>
          <option value={14}>Posted ≤ 14 days</option>
          <option value={30}>Posted ≤ 30 days</option>
          <option value={0}>Any date</option>
        </Select>
        <Select className="w-auto" aria-label="Country" value={value.countries[0] ?? ''} onChange={(e) => set('countries', e.target.value ? [e.target.value] : [])}>
          <option value="">All countries</option>
          {countries.map((c) => <option key={c} value={c}>{c === 'REMOTE' ? 'Remote (unspecified)' : COUNTRY_NAMES[c] ?? c}</option>)}
        </Select>
        <Select className="w-auto" aria-label="Minimum match" value={value.minScore} onChange={(e) => set('minScore', Number(e.target.value))}>
          <option value={0}>Any match</option>
          <option value={90}>Excellent (90+)</option>
          <option value={80}>Strong (80+)</option>
          <option value={70}>Good (70+)</option>
          <option value={60}>Moderate (60+)</option>
        </Select>
        <Button variant={more ? 'primary' : 'secondary'} onClick={() => setMore((m) => !m)} aria-expanded={more}><SlidersHorizontal className="size-4" />Filters</Button>
        {dirty && <Button variant="ghost" onClick={() => onChange(defaultFilters())}><RotateCcw className="size-4" />Reset</Button>}
      </div>
      {more && (
        <div className={clsx('grid gap-2 grid-cols-2 md:grid-cols-3 xl:grid-cols-6 anim-fade')}>
          <Select aria-label="Work arrangement" value={value.arrangement} onChange={(e) => set('arrangement', e.target.value as F['arrangement'])}>
            <option value="">Any arrangement</option><option>Remote</option><option>Hybrid</option><option>On-site</option>
          </Select>
          <Select aria-label="Sponsorship" value={value.sponsorship} onChange={(e) => set('sponsorship', e.target.value as F['sponsorship'])}>
            <option value="">Any sponsorship</option>
            <option value="viable">Relocation possible (hide D/E)</option>
            {(Object.keys(SPONSORSHIP_LABELS) as (keyof typeof SPONSORSHIP_LABELS)[]).map((k) => <option key={k} value={k}>{SPONSORSHIP_LABELS[k]}</option>)}
          </Select>
          <Select aria-label="Company" value={value.company} onChange={(e) => set('company', e.target.value)}>
            <option value="">All companies</option>
            {companies.map((c) => <option key={c}>{c}</option>)}
          </Select>
          <Select aria-label="Employment type" value={value.employmentType} onChange={(e) => set('employmentType', e.target.value)}>
            <option value="">Any employment type</option>
            {types.map((t) => <option key={t}>{t}</option>)}
          </Select>
          <Select aria-label="Experience" value={value.maxYears ?? ''} onChange={(e) => set('maxYears', e.target.value === '' ? null : Number(e.target.value))}>
            <option value="">Any experience</option>
            <option value={2}>Asks ≤ 2 years</option><option value={3}>Asks ≤ 3 years</option><option value={4}>Asks ≤ 4 years</option><option value={5}>Asks ≤ 5 years</option>
          </Select>
          <Select aria-label="Vacancy status" value={value.verification} onChange={(e) => set('verification', e.target.value as F['verification'])}>
            <option value="open">Open (verified + unverified)</option>
            <option value="verified">Verified only</option>
            <option value="unverified">Unverified only</option>
            <option value="closed">Closed / expired</option>
            <option value="all">Everything</option>
          </Select>
          <label className="col-span-2 md:col-span-3 xl:col-span-6 flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted pt-1">
            <span className="inline-flex items-center gap-2"><input type="checkbox" className="accent-[rgb(var(--accent))]" checked={value.salaryOnly} onChange={(e) => set('salaryOnly', e.target.checked)} />Only with published salary</span>
            <span className="inline-flex items-center gap-2"><input type="checkbox" className="accent-[rgb(var(--accent))]" checked={value.showDismissed} onChange={(e) => set('showDismissed', e.target.checked)} />Include not-interested and rejected</span>
          </label>
        </div>
      )}
    </div>
  );
}
