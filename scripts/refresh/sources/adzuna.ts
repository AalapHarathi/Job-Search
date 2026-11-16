// Adzuna Search API (free developer key): https://developer.adzuna.com/docs/search
// Adzuna listings point to Adzuna redirect pages, not the employer. They are
// stored with applicationUrl = null and verification "Unverified" unless the
// same vacancy is also found on the employer's own ATS board.
import { htmlToText } from '../../../shared/text';
import { getJson } from '../http';
import type { RawJob } from '../types';

export const ADZUNA_COUNTRIES: Record<string, string> = { GB: 'gb', AU: 'au', IN: 'in', US: 'us', DE: 'de', NL: 'nl', CA: 'ca', SG: 'sg', NZ: 'nz' };

interface AzJob {
  id: string; title: string; description: string; created: string; redirect_url: string;
  company?: { display_name?: string }; location?: { display_name?: string; area?: string[] };
  salary_min?: number; salary_max?: number; salary_is_predicted?: string | number;
  contract_time?: string; contract_type?: string;
}

export async function fetchAdzuna(countryCode: string, what: string, creds: { id: string; key: string }): Promise<{ jobs: RawJob[]; error: string | null }> {
  const cc = ADZUNA_COUNTRIES[countryCode];
  if (!cc) return { jobs: [], error: null };
  const qs = new URLSearchParams({
    app_id: creds.id, app_key: creds.key, what_phrase: what, max_days_old: '30', results_per_page: '50', sort_by: 'date', 'content-type': 'application/json',
  });
  const r = await getJson<{ results: AzJob[] }>(`https://api.adzuna.com/v1/api/jobs/${cc}/search/1?${qs}`);
  if (!r.data) return { jobs: [], error: `Adzuna ${countryCode} "${what}": ${r.error}` };
  const currency: Record<string, string> = { gb: 'GBP', au: 'AUD', in: 'INR', us: 'USD', de: 'EUR', nl: 'EUR', ca: 'CAD', sg: 'SGD', nz: 'NZD' };
  const jobs = r.data.results.map<RawJob>((j) => {
    const predicted = String(j.salary_is_predicted) === '1';
    return {
      source: 'adzuna',
      externalId: String(j.id),
      board: null,
      title: htmlToText(j.title),
      company: j.company?.display_name?.trim() || 'Unknown company',
      companyWebsite: null,
      applicationUrl: null,
      sourceUrl: j.redirect_url,
      location: j.location?.display_name ?? '',
      countryHint: countryCode,
      employmentType: [j.contract_time, j.contract_type].filter(Boolean).map((s) => s!.replace('_', ' ')).join(', ') || null,
      workplaceHint: null,
      // Adzuna's estimated ("predicted") salaries are never shown as real salaries.
      salary: !predicted && (j.salary_min || j.salary_max)
        ? { min: j.salary_min ?? null, max: j.salary_max ?? null, currency: currency[cc] ?? null, interval: 'year', text: null }
        : null,
      postedAt: j.created ?? null,
      postedDateSource: j.created ? 'First listed on Adzuna' : null,
      closingDate: null,
      description: htmlToText(j.description ?? ''),
    };
  });
  return { jobs, error: null };
}
