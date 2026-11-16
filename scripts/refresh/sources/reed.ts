// Reed.co.uk Jobseeker API (free key): https://www.reed.co.uk/developers/jobseeker
import { htmlToText } from '../../../shared/text';
import { getJson } from '../http';
import type { RawJob } from '../types';

interface ReedSearch {
  jobId: number; employerName: string; jobTitle: string; locationName: string; minimumSalary?: number; maximumSalary?: number;
  currency?: string; expirationDate?: string; date?: string; jobDescription?: string; jobUrl: string;
}
interface ReedDetail { jobDescription?: string; contractType?: string; fullTime?: boolean; partTime?: boolean; externalUrl?: string; salaryType?: string }

const dmy = (s?: string) => {
  if (!s) return null;
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(s);
  return m ? new Date(Date.UTC(+m[3], +m[2] - 1, +m[1])).toISOString() : null;
};

function auth(key: string) { return { Authorization: 'Basic ' + Buffer.from(`${key}:`).toString('base64') }; }

export async function searchReed(keywords: string, key: string): Promise<{ jobs: RawJob[]; error: string | null }> {
  const qs = new URLSearchParams({ keywords, resultsToTake: '100' });
  const r = await getJson<{ results: ReedSearch[] }>(`https://www.reed.co.uk/api/1.0/search?${qs}`, { headers: auth(key) });
  if (!r.data) return { jobs: [], error: `Reed "${keywords}": ${r.error}` };
  const jobs = r.data.results.map<RawJob>((j) => ({
    source: 'reed',
    externalId: String(j.jobId),
    board: null,
    title: j.jobTitle.trim(),
    company: j.employerName?.trim() || 'Unknown company',
    companyWebsite: null,
    applicationUrl: null,
    sourceUrl: j.jobUrl,
    location: j.locationName ?? '',
    countryHint: 'GB',
    employmentType: null,
    workplaceHint: null,
    salary: j.minimumSalary || j.maximumSalary ? { min: j.minimumSalary ?? null, max: j.maximumSalary ?? null, currency: j.currency || 'GBP', interval: null, text: null } : null,
    postedAt: dmy(j.date),
    postedDateSource: j.date ? 'Reed posted date' : null,
    closingDate: dmy(j.expirationDate),
    description: htmlToText(j.jobDescription ?? ''),
  }));
  return { jobs, error: null };
}

/** Fetch the full description; externalUrl (when present) is the employer's own application page. */
export async function enrichReed(job: RawJob, key: string): Promise<RawJob> {
  const r = await getJson<ReedDetail>(`https://www.reed.co.uk/api/1.0/jobs/${job.externalId}`, { headers: auth(key) });
  if (!r.data) return job;
  const d = r.data;
  return {
    ...job,
    description: d.jobDescription ? htmlToText(d.jobDescription) : job.description,
    employmentType: [d.fullTime ? 'Full time' : d.partTime ? 'Part time' : null, d.contractType].filter(Boolean).join(', ') || job.employmentType,
    applicationUrl: d.externalUrl && /^https?:\/\//.test(d.externalUrl) && !/reed\.co\.uk/.test(d.externalUrl) ? d.externalUrl : null,
    salary: job.salary ? { ...job.salary, interval: d.salaryType ?? job.salary.interval } : null,
  };
}
