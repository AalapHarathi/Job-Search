// Offline test: every ATS connector + index + search against fixture payloads.
import { fetchBoard, fetchLiveJob, type Getter } from '../shared/ats';
import { toIndexJob, filterIndex, skillOverlap } from '../shared/searchIndex';
import type { BoardRef } from '../shared/types';

const desc = '<p>We need a Business Analyst with 3+ years of experience in SQL, Power BI and stakeholder management. We are unable to offer visa sponsorship.</p>';
const fx: Record<string, unknown> = {
  'https://boards-api.greenhouse.io/v1/boards/acme/jobs?content=true': { jobs: [{ id: 11, title: 'Business Analyst', absolute_url: 'https://boards.greenhouse.io/acme/jobs/11', first_published: new Date(Date.now() - 2 * 864e5).toISOString(), location: { name: 'London, UK' }, content: desc }] },
  'https://boards-api.greenhouse.io/v1/boards/acme/jobs/11': { id: 11, title: 'Business Analyst', absolute_url: 'https://boards.greenhouse.io/acme/jobs/11', location: { name: 'London, UK' }, content: desc },
  'https://api.lever.co/v0/postings/beta?mode=json': [{ id: 'lv1', text: 'Data Analyst', hostedUrl: 'https://jobs.lever.co/beta/lv1', applyUrl: 'https://jobs.lever.co/beta/lv1/apply', createdAt: Date.now() - 864e5, categories: { location: 'Bengaluru, India' }, workplaceType: 'hybrid', descriptionPlain: 'SQL Python Tableau 2+ years experience' }],
  'https://api.ashbyhq.com/posting-api/job-board/gamma?includeCompensation=true': { jobs: [{ id: 'ab1', title: 'Product Analyst', jobUrl: 'https://jobs.ashbyhq.com/gamma/ab1', applyUrl: 'https://jobs.ashbyhq.com/gamma/ab1/application', location: 'Sydney, Australia', publishedAt: new Date().toISOString(), descriptionPlain: 'Amplitude SQL. Visa sponsorship available.' }] },
  'https://api.smartrecruiters.com/v1/companies/Delta/postings?limit=100&offset=0': { totalFound: 1, content: [{ id: 'sr1', name: 'Operations Analyst', releasedDate: new Date().toISOString(), company: { identifier: 'Delta', name: 'Delta' }, location: { city: 'Melbourne', country: 'au' }, typeOfEmployment: { label: 'Full-time' } }] },
  'https://apply.workable.com/api/v1/widget/accounts/eps?details=true': { name: 'Epsilon', jobs: [{ title: 'BI Analyst', shortcode: 'ABC123', url: 'https://apply.workable.com/j/ABC123', application_url: 'https://apply.workable.com/j/ABC123/apply', published_on: '2026-11-10', locations: [{ city: 'Dublin', country: 'Ireland', countryCode: 'IE' }], description: '<p>Power BI, Excel</p>' }] },
  'https://zeta.recruitee.com/api/offers/': { offers: [{ id: 5, slug: 'x', title: 'Reporting Analyst', careers_url: 'https://zeta.recruitee.com/o/x', careers_apply_url: 'https://zeta.recruitee.com/o/x/c/new', published_at: '2026-11-12 10:00:00 UTC', location: 'Amsterdam, Netherlands', country_code: 'NL', company_name: 'Zeta BV', description: '<p>SQL</p>', status: 'published' }] },
};
const get: Getter = async <T,>(url: string) => (url in fx ? { data: fx[url] as T, status: 200, error: null } : { data: null, status: 404, error: 'HTTP 404' });

const boards: BoardRef[] = [
  { source: 'greenhouse', token: 'acme', name: 'Acme', website: null },
  { source: 'lever', token: 'beta', name: 'Beta', website: null },
  { source: 'ashby', token: 'gamma', name: 'Gamma', website: null },
  { source: 'smartrecruiters', token: 'Delta', name: null, website: null },
  { source: 'workable', token: 'eps', name: null, website: null },
  { source: 'recruitee', token: 'zeta', name: null, website: null },
  { source: 'greenhouse', token: 'missing', name: null, website: null },
];
let fail = 0;
const ok = (c: boolean, m: string) => { console.log(`${c ? 'PASS' : 'FAIL'}  ${m}`); if (!c) fail++; };
(async () => {
  const skills: string[] = []; const table = new Map<string, number>(); const jobs = [];
  for (const b of boards) {
    const r = await fetchBoard(b, get);
    if (b.token === 'missing') { ok(!r.ok && /not found/.test(r.error ?? ''), 'missing board reports not found'); continue; }
    ok(r.ok && r.jobs.length === 1, `${b.source} board parsed`);
    ok(/^https:\/\//.test(r.jobs[0].applicationUrl ?? ''), `${b.source} has employer https apply URL (${r.jobs[0].applicationUrl})`);
    const ij = toIndexJob(r.jobs[0], b, table, skills); ok(!!ij, `${b.source} → index job`); jobs.push(ij!);
  }
  const gh = jobs[0];
  ok(gh.k === 'GB' && gh.sp === 'D' && gh.y === 3, `greenhouse country/sponsorship/years = ${gh.k}/${gh.sp}/${gh.y}`);
  ok(jobs[2].sp === 'A', 'ashby sponsorship confirmed');
  ok(jobs[1].k === 'IN' && jobs[1].w === 'Hybrid', 'lever India hybrid');
  ok(jobs[3].k === 'AU' && jobs[3].sp === null, 'smartrecruiters AU, sponsorship unknown without description');
  ok(jobs[4].k === 'IE' && jobs[5].k === 'NL', 'workable IE / recruitee NL');
  const base = { countries: [], includeRemote: true, arrangement: 'Any' as const, postedWithinDays: null, hideNoSponsorship: false, source: 'Any' as const };
  ok(filterIndex(jobs, { ...base, text: 'business analyst' }).length === 1, 'search "business analyst" → 1');
  ok(filterIndex(jobs, { ...base, text: 'analyst' }).length === 6, 'search "analyst" → 6');
  ok(filterIndex(jobs, { ...base, text: 'analy' }).length === 6, 'prefix "analy" → 6');
  ok(filterIndex(jobs, { ...base, text: 'bi' }).length === 1, '"bi" matches BI Analyst only');
  ok(filterIndex(jobs, { ...base, text: 'data analyst, product analyst' }).length === 2, 'comma OR → 2');
  ok(filterIndex(jobs, { ...base, text: 'analyst', countries: ['GB', 'IN'] }).length === 2, 'country filter GB+IN → 2');
  ok(filterIndex(jobs, { ...base, text: 'analyst', hideNoSponsorship: true }).length === 5, 'hide no-sponsorship removes 1');
  ok(filterIndex(jobs, { ...base, text: 'acme' }).length === 1, 'company search');
  ok(filterIndex(jobs, { ...base, text: '', postedWithinDays: 3 }).every((r) => r.job.p), 'posted filter drops undated');
  const ov = skillOverlap(gh, skills, new Set(['SQL'])); ok(ov.matched.includes('SQL') && ov.missing.length > 0, `skill overlap ${JSON.stringify(ov)}`);
  const live = await fetchLiveJob(boards[0], '11', get); ok(live.open === true && !!live.job?.description, 'live check greenhouse open');
  const gone = await fetchLiveJob(boards[0], '99', get); ok(gone.open === false, 'live check greenhouse removed → closed');
  const wk = await fetchLiveJob(boards[4], 'ABC123', get); ok(wk.open === true, 'live check workable via board');
  const down = await fetchLiveJob({ source: 'ashby', token: 'nope', name: null, website: null }, 'x', get); ok(down.open === null || down.open === false, 'unreachable/not-found board never reported open');
  console.log(fail ? `\n${fail} FAILED` : '\nAll offline ATS/search checks passed');
  process.exit(fail ? 1 : 0);
})();
