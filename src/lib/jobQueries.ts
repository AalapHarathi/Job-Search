import type { Job, Preferences, SponsorshipCategory, WorkArrangement } from '@shared/types';
import { ageDays } from '@shared/freshness';
import { SPONSORSHIP_RANK } from '@shared/sponsorship';
import { norm } from '@shared/text';

export interface JobFilters {
  q: string;
  countries: string[];
  arrangement: '' | WorkArrangement;
  sponsorship: '' | 'viable' | SponsorshipCategory;
  minScore: number;
  postedWithin: number; // days; 0 = any (still subject to the 30-day rule)
  employmentType: string;
  company: string;
  salaryOnly: boolean;
  maxYears: number | null;
  verification: 'open' | 'verified' | 'unverified' | 'closed' | 'all';
  showDismissed: boolean;
}

export const defaultFilters = (): JobFilters => ({
  q: '', countries: [], arrangement: '', sponsorship: '', minScore: 0, postedWithin: 14, employmentType: '', company: '',
  salaryOnly: false, maxYears: null, verification: 'open', showDismissed: false,
});

const DISMISSED = new Set(['Not Interested', 'Rejected', 'Withdrawn']);

/** The 30-day rule: older vacancies only appear when verified on the employer's site and enabled in preferences. */
export function passesAgeRule(j: Job, prefs: Preferences, withinDays: number): boolean {
  const age = ageDays(j.postedAt);
  if (age === null) return prefs.includeUndated;
  if (age > 30) return prefs.includeOlder && j.verification.status === 'Verified';
  return withinDays === 0 || age <= withinDays;
}

export function isOpen(j: Job) {
  return j.active && j.verification.status !== 'Closed';
}

export function applyFilters(jobs: Job[], f: JobFilters, prefs: Preferences): Job[] {
  const q = norm(f.q);
  return jobs.filter((j) => {
    if (f.verification === 'open' && !isOpen(j)) return false;
    if (f.verification === 'verified' && !(isOpen(j) && j.verification.status === 'Verified')) return false;
    if (f.verification === 'unverified' && !(isOpen(j) && j.verification.status === 'Unverified')) return false;
    if (f.verification === 'closed' && isOpen(j)) return false;
    if (f.verification !== 'closed' && f.verification !== 'all' && !passesAgeRule(j, prefs, f.postedWithin)) return false;
    if (!f.showDismissed && DISMISSED.has(j.status)) return false;
    if (f.countries.length && !f.countries.includes(j.country ?? 'REMOTE')) return false;
    if (f.arrangement && j.workArrangement !== f.arrangement) return false;
    if (f.sponsorship === 'viable' && ['D', 'E'].includes(j.sponsorship.category)) return false;
    if (f.sponsorship && f.sponsorship !== 'viable' && j.sponsorship.category !== f.sponsorship) return false;
    if (f.minScore && (j.match?.score ?? -1) < f.minScore) return false;
    if (f.employmentType && !norm(j.employmentType ?? '').includes(norm(f.employmentType))) return false;
    if (f.company && j.company !== f.company) return false;
    if (f.salaryOnly && !j.salary) return false;
    if (f.maxYears !== null && j.match?.requiredYears != null && j.match.requiredYears > f.maxYears) return false;
    if (q && !norm(`${j.title} ${j.company} ${j.location}`).includes(q)) return false;
    return true;
  });
}

export type SortKey = 'match' | 'posted' | 'company' | 'title' | 'salary' | 'verified' | 'location';
export function sortJobs(jobs: Job[], key: SortKey, dir: 'asc' | 'desc'): Job[] {
  const m = dir === 'asc' ? 1 : -1;
  const val = (j: Job): number | string => {
    switch (key) {
      case 'match': return j.match?.score ?? -1;
      case 'posted': return j.postedAt ? Date.parse(j.postedAt) : 0;
      case 'company': return j.company.toLowerCase();
      case 'title': return j.title.toLowerCase();
      case 'location': return (j.country ?? 'zz') + j.location.toLowerCase();
      case 'salary': return j.salary?.max ?? j.salary?.min ?? -1;
      case 'verified': return j.lastVerifiedAt ? Date.parse(j.lastVerifiedAt) : 0;
    }
  };
  return [...jobs].sort((a, b) => {
    const x = val(a); const y = val(b);
    return (x < y ? -1 : x > y ? 1 : 0) * m;
  });
}

const RECOMMENDABLE = new Set(['Discovered', 'Shortlisted', 'Saved', 'Ready to Apply']);

export function recommended(jobs: Job[], prefs: Preferences): Job[] {
  return jobs
    .filter((j) => isOpen(j) && j.match && j.match.score >= prefs.minRecommendedScore && RECOMMENDABLE.has(j.status))
    .filter((j) => !(prefs.requiresSponsorship && ['D', 'E'].includes(j.sponsorship.category)))
    .filter((j) => passesAgeRule(j, prefs, 30))
    .sort((a, b) =>
      b.match!.score - a.match!.score
      || (b.postedAt ? Date.parse(b.postedAt) : 0) - (a.postedAt ? Date.parse(a.postedAt) : 0)
      || SPONSORSHIP_RANK[a.sponsorship.category] - SPONSORSHIP_RANK[b.sponsorship.category]
      || (a.closingDate ? Date.parse(a.closingDate) : Infinity) - (b.closingDate ? Date.parse(b.closingDate) : Infinity));
}

export function whyRecommended(j: Job, prefs: Preferences): string[] {
  const m = j.match!;
  const out: string[] = [];
  out.push(`${m.score}/100 ${m.label.toLowerCase()} match${m.matchedSkills.length ? ` — shares ${m.matchedSkills.slice(0, 3).join(', ')}` : ''}.`);
  const age = ageDays(j.postedAt);
  if (age !== null) out.push(age <= 3 ? `Posted ${age === 0 ? 'today' : `${age} day${age > 1 ? 's' : ''} ago`} — early applicants are seen first.` : `Posted ${age} days ago.`);
  const pr = prefs.countries.find((c) => c.code === j.country)?.priority;
  if (pr === 1) out.push('In one of your top-priority countries.');
  if (j.sponsorship.category === 'A') out.push('Employer confirms visa sponsorship.');
  if (j.sponsorship.category === 'B') out.push('Posting mentions relocation or visa support.');
  if (j.sponsorship.category === 'N') out.push('India-based — no visa needed.');
  if (j.verification.status === 'Verified') out.push('Confirmed open on the employer’s own careers listing.');
  if (j.closingDate) out.push(`Closes ${j.closingDate.slice(0, 10)}.`);
  return out;
}
