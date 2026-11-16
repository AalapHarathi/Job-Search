// Ashby public job posting API (no key): https://developers.ashbyhq.com/docs/public-job-posting-api
import type { BoardRef } from '../../../shared/types';
import { htmlToText } from '../../../shared/text';
import { getJson } from '../http';
import type { BoardFetch, RawJob } from '../types';

interface AbJob {
  id: string; title: string; location?: string; secondaryLocations?: { location: string }[];
  isListed?: boolean; isRemote?: boolean; workplaceType?: string; employmentType?: string;
  descriptionHtml?: string; descriptionPlain?: string; publishedAt?: string; jobUrl: string; applyUrl?: string;
  address?: { postalAddress?: { addressCountry?: string } };
  compensation?: {
    compensationTierSummary?: string;
    summaryComponents?: { compensationType: string; interval?: string; currencyCode?: string; minValue?: number; maxValue?: number }[];
  };
}

export async function fetchAshby(b: BoardRef): Promise<BoardFetch> {
  const r = await getJson<{ jobs: AbJob[] }>(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(b.token)}?includeCompensation=true`);
  if (!r.data) return { board: b.token, source: 'ashby', ok: false, jobs: [], error: r.status === 404 ? `Board "${b.token}" not found` : r.error };
  const company = b.name || b.token;
  const out: RawJob[] = r.data.jobs.filter((j) => j.isListed !== false).map((j) => {
    const sal = j.compensation?.summaryComponents?.find((c) => c.compensationType === 'Salary');
    const locs = [j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)].filter(Boolean).join('; ');
    const wt = j.workplaceType === 'Remote' || j.isRemote ? 'Remote' : j.workplaceType === 'Hybrid' ? 'Hybrid' : j.workplaceType === 'OnSite' ? 'On-site' : null;
    return {
      source: 'ashby',
      externalId: j.id,
      board: b.token,
      title: j.title.trim(),
      company,
      companyWebsite: b.website,
      applicationUrl: j.applyUrl || j.jobUrl,
      sourceUrl: j.jobUrl,
      location: locs,
      countryHint: j.address?.postalAddress?.addressCountry ?? null,
      employmentType: j.employmentType ?? null,
      workplaceHint: wt,
      salary: sal && (sal.minValue || sal.maxValue)
        ? { min: sal.minValue ?? null, max: sal.maxValue ?? null, currency: sal.currencyCode ?? null, interval: sal.interval ?? null, text: j.compensation?.compensationTierSummary ?? null }
        : null,
      postedAt: j.publishedAt ?? null,
      postedDateSource: j.publishedAt ? 'Ashby published date' : null,
      closingDate: null,
      description: j.descriptionPlain || htmlToText(j.descriptionHtml ?? ''),
    };
  });
  return { board: b.token, source: 'ashby', ok: true, jobs: out, error: null };
}
