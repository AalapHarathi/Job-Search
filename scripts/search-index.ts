/*
 * Builds the public search index (data/jobs-index.json) from every employer
 * board in shared/companies.ts plus any extra boards in EXTRA_BOARDS.
 * Runs in GitHub Actions before each deploy. Only public job-posting data.
 *
 *   OUT=dist/data/jobs-index.json npm run index
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { COMPANY_DIRECTORY } from '../shared/companies';
import type { BoardRef } from '../shared/types';
import type { IndexBoard, IndexJob, SearchIndex } from '../shared/searchIndex';
import { toIndexJob } from '../shared/searchIndex';
import { fetchBoard } from './refresh/sources/boards';
import { pool } from './refresh/http';

const OUT = process.env.OUT || 'dist/data/jobs-index.json';
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

function extraBoards(): BoardRef[] {
  return (process.env.EXTRA_BOARDS || '').split(/[,\s]+/).filter(Boolean).map((s) => {
    const [source, ...rest] = s.split(':');
    return { source: source as BoardRef['source'], token: rest.join(':'), name: null, website: null };
  });
}

async function main() {
  const seen = new Set<string>();
  const boards = [...COMPANY_DIRECTORY, ...extraBoards()].filter((b) => {
    const k = `${b.source}:${b.token.toLowerCase()}`;
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
  log(`Crawling ${boards.length} employer boards…`);
  const skills: string[] = [];
  const skillTable = new Map<string, number>();
  const jobs = new Map<string, IndexJob>();
  const report: IndexBoard[] = [];

  await pool(boards, 8, async (b) => {
    let res;
    try { res = await fetchBoard(b); }
    catch (e) { res = { ok: false, jobs: [], error: (e as Error).message }; }
    let kept = 0;
    for (const raw of res.jobs) {
      const j = toIndexJob(raw, b, skillTable, skills);
      if (!j || jobs.has(j.id)) continue;
      jobs.set(j.id, j);
      kept++;
    }
    const name = b.name || res.jobs[0]?.company || b.token;
    report.push({ source: b.source, token: b.token, name, ok: res.ok, jobs: kept, error: res.ok ? null : res.error });
    log(`${res.ok ? '✓' : '✗'} ${b.source}:${b.token} — ${res.ok ? `${kept} jobs` : res.error}`);
  });

  const okBoards = report.filter((r) => r.ok).length;
  if (!jobs.size) {
    console.error('No jobs were collected from any board. Not writing an empty index.');
    process.exit(1);
  }
  const index: SearchIndex = {
    version: 1,
    builtAt: new Date().toISOString(),
    skills,
    boards: report.sort((a, b) => a.name.localeCompare(b.name)),
    jobs: [...jobs.values()],
  };
  mkdirSync(dirname(OUT), { recursive: true });
  const json = JSON.stringify(index);
  writeFileSync(OUT, json);
  log(`Wrote ${OUT}: ${jobs.size} jobs from ${okBoards}/${boards.length} boards (${(json.length / 1e6).toFixed(1)} MB)`);
  if (process.env.GITHUB_STEP_SUMMARY) {
    const failed = report.filter((r) => !r.ok);
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, `### Search index\n${jobs.size} open jobs from ${okBoards} of ${boards.length} employer boards.\n${failed.length ? `\nFailed boards: ${failed.map((f) => `${f.source}:${f.token} (${f.error})`).join(', ')}\n` : ''}`, { flag: 'a' });
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
