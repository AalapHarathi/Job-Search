// Employer applicant-tracking-system (ATS) connectors, shared by the scheduled
// Node jobs and the browser. Every connector reads the employer's own public
// job board, so `applicationUrl` is always the employer's official application
// page — never a job-aggregator redirect.
//
// The HTTP layer is injected (`Getter`) so Node can add retries/rate limiting
// and the browser can use plain CORS fetches.
import type { BoardRef, Salary, SourceId } from './types';
import { htmlToText } from './text';

export interface RawJob {
  source: SourceId;
  externalId: string;
  board: string | null;
  title: string;
  company: string;
  companyWebsite: string | null;
  applicationUrl: string | null; // employer/ATS page; null for aggregator-only listings
  sourceUrl: string;
  location: string;
  countryHint: string | null;
  employmentType: string | null;
  workplaceHint: string | null;
  salary: Salary | null;
  postedAt: string | null;
  postedDateSource: string | null;
  closingDate: string | null;
  description: string;
}

export interface BoardFetch { board: string; source: SourceId; ok: boolean; jobs: RawJob[]; error: string | null }

export type Getter = <T>(url: string) => Promise<{ data: T | null; status: number; error: string | null }>;

/** Minimal browser getter: no custom headers, so requests stay CORS-simple. */
export const browserGetter: Getter = async <T,>(url: string) => {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 20000);
  try {
    const r = await fetch(url, { signal: ctl.signal });
    if (!r.ok) return { data: null, status: r.status, error: `HTTP ${r.status}` };
    return { data: (await r.json()) as T, status: r.status, error: null };
  } catch (e) {
    return { data: null, status: 0, error: (e as Error).message };
  } finally { clearTimeout(t); }
};

const notFound = (b: BoardRef, status: number, error: string | null) => (status === 404 ? `Board "${b.token}" not found` : error ?? `HTTP ${status}`);

// ---------------------------------------------------------------- Greenhouse
interface GhJob {
  id: number; title: string; absolute_url: string; first_published?: string;
  location?: { name?: string }; content?: string; metadata?: { name: string; value: unknown }[] | null;
}
function ghRaw(b: BoardRef, company: string, j: GhJob): RawJob {
  const empType = (j.metadata ?? []).find((m) => /employment|job type|contract/i.test(m.name));
  return {
    source: 'greenhouse', externalId: String(j.id), board: b.token, title: j.title.trim(), company,
    companyWebsite: b.website, applicationUrl: j.absolute_url, sourceUrl: j.absolute_url,
    location: j.location?.name?.trim() || '', countryHint: null,
    employmentType: typeof empType?.value === 'string' ? empType.value : null,
    workplaceHint: j.location?.name ?? null, salary: null,
    // Only first_published is a true posting date; updated_at is not used as one.
    postedAt: j.first_published ?? null, postedDateSource: j.first_published ? 'Greenhouse first published' : null,
    closingDate: null, description: htmlToText(j.content ?? ''),
  };
}
export async function greenhouseBoard(b: BoardRef, get: Getter, withContent = true): Promise<BoardFetch> {
  const base = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.token)}`;
  const [jobs, board] = await Promise.all([
    get<{ jobs: GhJob[] }>(`${base}/jobs${withContent ? '?content=true' : ''}`),
    b.name ? Promise.resolve({ data: { name: b.name }, error: null, status: 200 }) : get<{ name: string }>(base),
  ]);
  if (!jobs.data) return { board: b.token, source: 'greenhouse', ok: false, jobs: [], error: notFound(b, jobs.status, jobs.error) };
  const company = b.name || board.data?.name || b.token;
  return { board: b.token, source: 'greenhouse', ok: true, jobs: jobs.data.jobs.map((j) => ghRaw(b, company, j)), error: null };
}

// --------------------------------------------------------------------- Lever
interface LvJob {
  id: string; text: string; hostedUrl: string; applyUrl?: string; createdAt?: number; country?: string;
  categories?: { location?: string; commitment?: string; team?: string; allLocations?: string[] };
  workplaceType?: string; descriptionPlain?: string; description?: string;
  lists?: { text: string; content: string }[]; additionalPlain?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}
function lvRaw(b: BoardRef, company: string, j: LvJob): RawJob {
  const lists = (j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join('\n\n');
  const desc = [j.descriptionPlain ?? htmlToText(j.description ?? ''), lists, j.additionalPlain ?? ''].filter(Boolean).join('\n\n');
  const sr = j.salaryRange;
  const wt = j.workplaceType === 'remote' ? 'Remote' : j.workplaceType === 'hybrid' ? 'Hybrid' : j.workplaceType === 'onsite' ? 'On-site' : null;
  return {
    source: 'lever', externalId: j.id, board: b.token, title: j.text.trim(), company, companyWebsite: b.website,
    applicationUrl: j.applyUrl || j.hostedUrl, sourceUrl: j.hostedUrl,
    location: (j.categories?.allLocations?.join('; ') || j.categories?.location || '').trim(),
    countryHint: j.country ?? null, employmentType: j.categories?.commitment ?? null, workplaceHint: wt,
    salary: sr && (sr.min || sr.max) ? { min: sr.min ?? null, max: sr.max ?? null, currency: sr.currency ?? null, interval: sr.interval ?? null, text: null } : null,
    postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null, postedDateSource: j.createdAt ? 'Lever created date' : null,
    closingDate: null, description: desc,
  };
}
const leverHost = (token: string) => (token.startsWith('eu:') ? ['https://api.eu.lever.co', token.slice(3)] : ['https://api.lever.co', token]);
export async function leverBoard(b: BoardRef, get: Getter): Promise<BoardFetch> {
  // Prefix a token with "eu:" for companies hosted on Lever's EU instance.
  const [host, token] = leverHost(b.token);
  const r = await get<LvJob[]>(`${host}/v0/postings/${encodeURIComponent(token)}?mode=json`);
  if (!r.data) return { board: b.token, source: 'lever', ok: false, jobs: [], error: notFound(b, r.status, r.error) };
  const company = b.name || token;
  return { board: b.token, source: 'lever', ok: true, jobs: r.data.map((j) => lvRaw(b, company, j)), error: null };
}

// --------------------------------------------------------------------- Ashby
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
function abRaw(b: BoardRef, company: string, j: AbJob): RawJob {
  const sal = j.compensation?.summaryComponents?.find((c) => c.compensationType === 'Salary');
  const locs = [j.location, ...(j.secondaryLocations ?? []).map((s) => s.location)].filter(Boolean).join('; ');
  const wt = j.workplaceType === 'Remote' || j.isRemote ? 'Remote' : j.workplaceType === 'Hybrid' ? 'Hybrid' : j.workplaceType === 'OnSite' ? 'On-site' : null;
  return {
    source: 'ashby', externalId: j.id, board: b.token, title: j.title.trim(), company, companyWebsite: b.website,
    applicationUrl: j.applyUrl || j.jobUrl, sourceUrl: j.jobUrl, location: locs,
    countryHint: j.address?.postalAddress?.addressCountry ?? null, employmentType: j.employmentType ?? null, workplaceHint: wt,
    salary: sal && (sal.minValue || sal.maxValue)
      ? { min: sal.minValue ?? null, max: sal.maxValue ?? null, currency: sal.currencyCode ?? null, interval: sal.interval ?? null, text: j.compensation?.compensationTierSummary ?? null }
      : null,
    postedAt: j.publishedAt ?? null, postedDateSource: j.publishedAt ? 'Ashby published date' : null,
    closingDate: null, description: j.descriptionPlain || htmlToText(j.descriptionHtml ?? ''),
  };
}
export async function ashbyBoard(b: BoardRef, get: Getter): Promise<BoardFetch> {
  const r = await get<{ jobs: AbJob[] }>(`https://api.ashbyhq.com/posting-api/job-board/${encodeURIComponent(b.token)}?includeCompensation=true`);
  if (!r.data) return { board: b.token, source: 'ashby', ok: false, jobs: [], error: notFound(b, r.status, r.error) };
  const company = b.name || b.token;
  return { board: b.token, source: 'ashby', ok: true, jobs: r.data.jobs.filter((j) => j.isListed !== false).map((j) => abRaw(b, company, j)), error: null };
}

// ----------------------------------------------------------- SmartRecruiters
// https://developers.smartrecruiters.com/docs/posting-api
interface SrPosting {
  id: string; name: string; releasedDate?: string; company?: { identifier?: string; name?: string };
  location?: { city?: string; region?: string; country?: string; remote?: boolean; hybrid?: boolean; fullLocation?: string };
  typeOfEmployment?: { label?: string };
  jobAd?: { sections?: Record<string, { title?: string; text?: string }> };
  postingUrl?: string; applyUrl?: string;
}
function srRaw(b: BoardRef, p: SrPosting, description = ''): RawJob {
  const loc = p.location;
  const where = loc?.fullLocation || [loc?.city, loc?.region, loc?.country?.toUpperCase()].filter(Boolean).join(', ');
  const url = p.postingUrl || `https://jobs.smartrecruiters.com/${encodeURIComponent(p.company?.identifier || b.token)}/${p.id}`;
  return {
    source: 'smartrecruiters', externalId: p.id, board: b.token, title: p.name.trim(),
    company: b.name || p.company?.name || b.token, companyWebsite: b.website,
    applicationUrl: p.applyUrl || url, sourceUrl: url, location: where || (loc?.remote ? 'Remote' : ''),
    countryHint: loc?.country ?? null, employmentType: p.typeOfEmployment?.label ?? null,
    workplaceHint: loc?.remote ? 'Remote' : loc?.hybrid ? 'Hybrid' : null, salary: null,
    postedAt: p.releasedDate ?? null, postedDateSource: p.releasedDate ? 'SmartRecruiters released date' : null,
    closingDate: null, description,
  };
}
function srDescription(p: SrPosting): string {
  return Object.values(p.jobAd?.sections ?? {}).map((s) => [s.title, htmlToText(s.text ?? '')].filter(Boolean).join('\n')).join('\n\n');
}
export async function smartRecruitersBoard(b: BoardRef, get: Getter, maxPages = 20): Promise<BoardFetch> {
  const base = `https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(b.token)}/postings`;
  const all: SrPosting[] = [];
  for (let page = 0; page < maxPages; page++) {
    const r = await get<{ totalFound: number; content: SrPosting[] }>(`${base}?limit=100&offset=${page * 100}`);
    if (!r.data) {
      if (page === 0) return { board: b.token, source: 'smartrecruiters', ok: false, jobs: [], error: notFound(b, r.status, r.error) };
      break;
    }
    all.push(...r.data.content);
    if (all.length >= r.data.totalFound || !r.data.content.length) break;
  }
  if (!all.length) return { board: b.token, source: 'smartrecruiters', ok: false, jobs: [], error: `No postings for "${b.token}"` };
  return { board: b.token, source: 'smartrecruiters', ok: true, jobs: all.map((p) => srRaw(b, p)), error: null };
}

// ------------------------------------------------------------------ Workable
interface WkJob {
  title: string; shortcode: string; employment_type?: string; telecommuting?: boolean; url: string; application_url?: string;
  published_on?: string; created_at?: string; country?: string; city?: string; state?: string; description?: string;
  locations?: { country?: string; countryCode?: string; city?: string; region?: string; hidden?: boolean }[];
}
function wkRaw(b: BoardRef, company: string, j: WkJob): RawJob {
  const locs = (j.locations ?? []).filter((l) => !l.hidden).map((l) => [l.city, l.region, l.country].filter(Boolean).join(', '));
  const where = locs.join('; ') || [j.city, j.state, j.country].filter(Boolean).join(', ');
  const posted = j.published_on || j.created_at || null;
  return {
    source: 'workable', externalId: j.shortcode, board: b.token, title: j.title.trim(), company, companyWebsite: b.website,
    applicationUrl: j.application_url || j.url, sourceUrl: j.url, location: where || (j.telecommuting ? 'Remote' : ''),
    countryHint: j.locations?.[0]?.countryCode ?? j.country ?? null, employmentType: j.employment_type ?? null,
    workplaceHint: j.telecommuting ? 'Remote' : null, salary: null,
    postedAt: posted ? new Date(posted).toISOString() : null, postedDateSource: posted ? 'Workable published date' : null,
    closingDate: null, description: htmlToText(j.description ?? ''),
  };
}
export async function workableBoard(b: BoardRef, get: Getter): Promise<BoardFetch> {
  const r = await get<{ name?: string; jobs: WkJob[] }>(`https://apply.workable.com/api/v1/widget/accounts/${encodeURIComponent(b.token)}?details=true`);
  if (!r.data) return { board: b.token, source: 'workable', ok: false, jobs: [], error: notFound(b, r.status, r.error) };
  const company = b.name || r.data.name || b.token;
  return { board: b.token, source: 'workable', ok: true, jobs: r.data.jobs.map((j) => wkRaw(b, company, j)), error: null };
}

// ----------------------------------------------------------------- Recruitee
interface RcOffer {
  id: number; slug: string; title: string; description?: string; requirements?: string; location?: string;
  city?: string; country?: string; country_code?: string; remote?: boolean; hybrid?: boolean;
  careers_url: string; careers_apply_url?: string; published_at?: string; created_at?: string;
  employment_type_code?: string; company_name?: string; status?: string;
  salary?: { min?: string | number | null; max?: string | number | null; currency?: string | null; period?: string | null } | null;
}
function rcRaw(b: BoardRef, o: RcOffer): RawJob {
  const posted = o.published_at || o.created_at || null;
  const num = (v: unknown) => (v == null || v === '' ? null : Number(v) || null);
  const sal = o.salary && (num(o.salary.min) || num(o.salary.max))
    ? { min: num(o.salary.min), max: num(o.salary.max), currency: o.salary.currency ?? null, interval: o.salary.period ?? null, text: null } : null;
  return {
    source: 'recruitee', externalId: String(o.id), board: b.token, title: o.title.trim(),
    company: b.name || o.company_name || b.token, companyWebsite: b.website,
    applicationUrl: o.careers_apply_url || o.careers_url, sourceUrl: o.careers_url,
    location: o.location || [o.city, o.country].filter(Boolean).join(', ') || (o.remote ? 'Remote' : ''),
    countryHint: o.country_code ?? null, employmentType: o.employment_type_code ?? null,
    workplaceHint: o.remote ? 'Remote' : o.hybrid ? 'Hybrid' : null, salary: sal,
    postedAt: posted ? new Date(posted.replace(' UTC', 'Z').replace(' ', 'T')).toISOString() : null,
    postedDateSource: posted ? 'Recruitee published date' : null, closingDate: null,
    description: [htmlToText(o.description ?? ''), htmlToText(o.requirements ?? '')].filter(Boolean).join('\n\n'),
  };
}
export async function recruiteeBoard(b: BoardRef, get: Getter): Promise<BoardFetch> {
  const r = await get<{ offers: RcOffer[] }>(`https://${encodeURIComponent(b.token)}.recruitee.com/api/offers/`);
  if (!r.data) return { board: b.token, source: 'recruitee', ok: false, jobs: [], error: notFound(b, r.status, r.error) };
  return { board: b.token, source: 'recruitee', ok: true, jobs: r.data.offers.filter((o) => !o.status || o.status === 'published').map((o) => rcRaw(b, o)), error: null };
}

// ------------------------------------------------------------------ dispatch
export function fetchBoard(b: BoardRef, get: Getter): Promise<BoardFetch> {
  switch (b.source) {
    case 'greenhouse': return greenhouseBoard(b, get);
    case 'lever': return leverBoard(b, get);
    case 'ashby': return ashbyBoard(b, get);
    case 'smartrecruiters': return smartRecruitersBoard(b, get);
    case 'workable': return workableBoard(b, get);
    case 'recruitee': return recruiteeBoard(b, get);
  }
}

/**
 * Re-read ONE vacancy from the employer's board. Returns the full listing when it
 * is still published, `open: false` when the board loaded but the vacancy is gone,
 * and `open: null` when the board could not be reached (never assumed open).
 */
export async function fetchLiveJob(b: BoardRef, externalId: string, get: Getter): Promise<{ open: boolean | null; job: RawJob | null; note: string }> {
  const gone = { open: false, job: null, note: 'No longer listed on the employer’s board' };
  const down = (e: string | null) => ({ open: null, job: null, note: `Employer board unreachable (${e ?? 'error'})` });
  if (b.source === 'greenhouse') {
    const r = await get<GhJob>(`https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.token)}/jobs/${encodeURIComponent(externalId)}`);
    if (r.status === 404) return gone;
    if (!r.data) return down(r.error);
    return { open: true, job: ghRaw(b, b.name || b.token, r.data), note: 'Listed on the employer’s Greenhouse board' };
  }
  if (b.source === 'lever') {
    const [host, token] = leverHost(b.token);
    const r = await get<LvJob>(`${host}/v0/postings/${encodeURIComponent(token)}/${encodeURIComponent(externalId)}?mode=json`);
    if (r.status === 404) return gone;
    if (!r.data) return down(r.error);
    return { open: true, job: lvRaw(b, b.name || token, r.data), note: 'Listed on the employer’s Lever board' };
  }
  if (b.source === 'smartrecruiters') {
    const r = await get<SrPosting>(`https://api.smartrecruiters.com/v1/companies/${encodeURIComponent(b.token)}/postings/${encodeURIComponent(externalId)}`);
    if (r.status === 404) return gone;
    if (!r.data) return down(r.error);
    return { open: true, job: srRaw(b, r.data, srDescription(r.data)), note: 'Listed on the employer’s SmartRecruiters board' };
  }
  const board = await fetchBoard(b, get);
  if (!board.ok) return down(board.error);
  const job = board.jobs.find((j) => j.externalId === externalId) ?? null;
  return job ? { open: true, job, note: `Listed on the employer’s ${b.source[0].toUpperCase() + b.source.slice(1)} board` } : gone;
}
