// Check your sources without touching Firebase:  npm run refresh:dry
// Uses the starter boards plus any you pass: npm run refresh:dry -- greenhouse:monzo lever:eu:acme
import { STARTER_BOARDS, DEFAULT_TARGET_TITLES } from '../shared/defaults';
import type { BoardRef } from '../shared/types';
import { fetchBoard } from './refresh/sources/boards';
import { fetchAdzuna } from './refresh/sources/adzuna';
import { searchReed } from './refresh/sources/reed';
import { isRelevantTitle } from '../shared/titles';
import { detectCountry } from '../shared/geo';
import { classifySponsorship } from '../shared/sponsorship';

const extra: BoardRef[] = process.argv.slice(2).map((a) => {
  const [source, ...rest] = a.split(':');
  return { source: source as BoardRef['source'], token: rest.join(':'), name: null, website: null };
});
const boards = extra.length ? extra : STARTER_BOARDS;

for (const b of boards) {
  const r = await fetchBoard(b);
  if (!r.ok) { console.log(`✗ ${b.source}:${b.token} — ${r.error}`); continue; }
  const rel = r.jobs.filter((j) => isRelevantTitle(j.title));
  console.log(`✓ ${b.source}:${b.token} — ${r.jobs.length} open roles, ${rel.length} analyst-type`);
  for (const j of rel.slice(0, 5)) {
    const c = detectCountry(j.location, j.countryHint);
    console.log(`    ${j.title} | ${j.location || '—'} [${c ?? '?'}] | posted ${j.postedAt?.slice(0, 10) ?? 'n/a'} | sponsorship ${classifySponsorship(j.description, c).category}`);
  }
}
if (process.env.ADZUNA_APP_ID && process.env.ADZUNA_APP_KEY) {
  const r = await fetchAdzuna('GB', DEFAULT_TARGET_TITLES[0], { id: process.env.ADZUNA_APP_ID, key: process.env.ADZUNA_APP_KEY });
  console.log(r.error ? `✗ Adzuna — ${r.error}` : `✓ Adzuna GB "${DEFAULT_TARGET_TITLES[0]}" — ${r.jobs.length} results`);
} else console.log('– Adzuna skipped (set ADZUNA_APP_ID / ADZUNA_APP_KEY to test)');
if (process.env.REED_API_KEY) {
  const r = await searchReed(DEFAULT_TARGET_TITLES[0], process.env.REED_API_KEY);
  console.log(r.error ? `✗ Reed — ${r.error}` : `✓ Reed "${DEFAULT_TARGET_TITLES[0]}" — ${r.jobs.length} results`);
} else console.log('– Reed skipped (set REED_API_KEY to test)');
