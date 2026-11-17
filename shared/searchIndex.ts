// Compact, public search index of open vacancies on employer job boards.
// Built server-side (scripts/search-index.ts) and published with the site as
// data/jobs-index.json. Contains only public job-posting data — never user data.
import type { AtsSource, BoardRef, SponsorshipCategory, WorkArrangement } from './types';
import type { RawJob } from './ats';
import { detectArrangement, detectCountry } from './geo';
import { dedupeKey, jobIdFromKey } from './dedupe';
import { classifySponsorship } from './sponsorship';
import { extractSkills, DOMAIN_SKILLS } from './skills';
import { requiredYears } from './matching';
import { norm } from './text';

export interface IndexJob {
  id: string; // same id the dashboard/refresh job uses, so saved state lines up
  t: string; // title
  c: string; // company
  l: string; // location as published
  k: string | null; // ISO country (null = unknown / remote)
  w: WorkArrangement;
  p: string | null; // posted date YYYY-MM-DD (null = not published by employer)
  u: string; // employer application URL
  s: AtsSource;
  b: string; // board token
  x: string; // posting id on the board
  sp: SponsorshipCategory | null; // null when the board gives no description
  sk: number[]; // indices into SearchIndex.skills
  y: number | null; // years of experience requested
  e: string | null; // employment type
}

export interface IndexBoard { source: AtsSource; token: string; name: string; ok: boolean; jobs: number; error: string | null }

export interface SearchIndex { version: 1; builtAt: string; skills: string[]; boards: IndexBoard[]; jobs: IndexJob[] }

export function toIndexJob(raw: RawJob, board: BoardRef, skillTable: Map<string, number>, skills: string[]): IndexJob | null {
  if (!raw.title || !raw.applicationUrl || !/^https:\/\//.test(raw.applicationUrl)) return null;
  const country = detectCountry(raw.location, raw.countryHint);
  const w = (['Remote', 'Hybrid', 'On-site'] as string[]).includes(raw.workplaceHint ?? '')
    ? (raw.workplaceHint as WorkArrangement)
    : detectArrangement(raw.location, raw.workplaceHint, raw.description.slice(0, 2000));
  const desc = raw.description || '';
  const sk = desc ? extractSkills(desc).filter((s) => !DOMAIN_SKILLS.includes(s)).map((s) => {
    if (!skillTable.has(s)) { skillTable.set(s, skills.length); skills.push(s); }
    return skillTable.get(s)!;
  }) : [];
  return {
    id: jobIdFromKey(dedupeKey(raw.company, raw.title, raw.location, country)),
    t: raw.title, c: raw.company, l: raw.location, k: country, w,
    p: raw.postedAt ? raw.postedAt.slice(0, 10) : null,
    u: raw.applicationUrl, s: board.source, b: board.token, x: raw.externalId,
    sp: desc ? classifySponsorship(desc, country).category : null,
    sk, y: desc ? requiredYears(desc) : null, e: raw.employmentType,
  };
}

// ------------------------------------------------------------------ querying
export interface SearchQuery {
  text: string;
  countries: string[]; // empty = any
  includeRemote: boolean;
  arrangement: WorkArrangement | 'Any';
  postedWithinDays: number | null; // null = any
  hideNoSponsorship: boolean;
  source: AtsSource | 'Any';
}

const SYNONYMS: Record<string, string[]> = {
  ba: ['business analyst'], bi: ['business intelligence'], 'data analyst': ['data analytics'],
  pm: ['product manager'], swe: ['software engineer'], ml: ['machine learning'],
};

/** Split the query into AND-ed terms; quoted phrases stay together; commas mean OR.
 *  Common abbreviations also search their expansion ("bi" → also "business intelligence"). */
export function parseQuery(q: string): string[][] {
  const groups: string[][] = [];
  for (const part of q.split(',')) {
    const phrases: string[] = [];
    const rest = part.replace(/"([^"]+)"/g, (_, p: string) => { phrases.push(norm(p)); return ' '; });
    const g = [...phrases, ...norm(rest).split(' ').filter(Boolean)];
    if (!g.length) continue;
    groups.push(g);
    for (const alt of SYNONYMS[norm(part.replace(/"/g, ''))] ?? []) groups.push(alt.split(' '));
  }
  return groups;
}

export function matchesText(j: IndexJob, groups: string[][]): number {
  if (!groups.length) return 1;
  // Terms match at word starts ("analy" finds "analyst", "bi" does not match "mobile").
  const title = ' ' + norm(j.t) + ' ';
  const hay = title + ' ' + norm(j.c) + ' ' + norm(j.l) + ' ';
  let best = 0;
  for (const g of groups) {
    if (!g.every((term) => hay.includes(' ' + term))) continue;
    const phrase = g.join(' ');
    const score = title.includes(` ${phrase} `) ? 3 : g.every((term) => title.includes(' ' + term)) ? 2 : 1;
    best = Math.max(best, score);
  }
  return best;
}

export function filterIndex(jobs: IndexJob[], q: SearchQuery, now = Date.now()): { job: IndexJob; rel: number }[] {
  const groups = parseQuery(q.text);
  const out: { job: IndexJob; rel: number }[] = [];
  for (const j of jobs) {
    if (q.source !== 'Any' && j.s !== q.source) continue;
    if (q.arrangement !== 'Any' && j.w !== q.arrangement) continue;
    if (q.countries.length) {
      const inCountry = j.k !== null && q.countries.includes(j.k);
      const remoteOk = q.includeRemote && j.w === 'Remote' && (j.k === null || q.countries.includes(j.k));
      if (!inCountry && !remoteOk) continue;
    }
    if (q.postedWithinDays !== null) {
      if (!j.p) continue;
      if ((now - Date.parse(j.p)) / 86_400_000 > q.postedWithinDays) continue;
    }
    if (q.hideNoSponsorship && (j.sp === 'D' || j.sp === 'E')) continue;
    const rel = matchesText(j, groups);
    if (!rel) continue;
    out.push({ job: j, rel });
  }
  return out;
}

/** Transparent skill overlap with the resume. Not the full 100-point match score. */
export function skillOverlap(j: IndexJob, skills: string[], resumeSkills: Set<string>): { matched: string[]; missing: string[] } {
  const names = j.sk.map((i) => skills[i]).filter(Boolean);
  return { matched: names.filter((n) => resumeSkills.has(n)), missing: names.filter((n) => !resumeSkills.has(n)) };
}
