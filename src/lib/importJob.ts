// Turns a search result into a tracked vacancy in Firestore.
// The vacancy is re-read live from the employer's own board first, so nothing
// is saved unless the employer still lists it.
import { setDoc } from 'firebase/firestore';
import { browserGetter, fetchLiveJob } from '@shared/ats';
import type { IndexJob } from '@shared/searchIndex';
import type { ApplicationStatus, BoardRef, Job, Preferences, ResumeVersion, WorkArrangement } from '@shared/types';
import { SOURCE_LABELS } from '@shared/types';
import { detectArrangement, detectCountry } from '@shared/geo';
import { dedupeKey, jobIdFromKey } from '@shared/dedupe';
import { classifySponsorship } from '@shared/sponsorship';
import { jobDetailsFromText, scoreAcrossVersions } from '@shared/matching';
import { paths, savePreferences } from './db';

export class ListingClosedError extends Error {}

export function boardOf(j: IndexJob, name?: string | null): BoardRef {
  return { source: j.s, token: j.b, name: name ?? j.c, website: null };
}

/** Live check only: is this vacancy still on the employer's board? */
export async function checkStillOpen(j: IndexJob) {
  return fetchLiveJob(boardOf(j), j.x, browserGetter);
}

export async function importIndexJob(
  uid: string, j: IndexJob, ctx: { prefs: Preferences; resumes: ResumeVersion[]; existing: Job | undefined; status: ApplicationStatus },
): Promise<Job> {
  if (ctx.existing) return ctx.existing;
  const board = boardOf(j);
  const live = await fetchLiveJob(board, j.x, browserGetter);
  if (live.open === false) throw new ListingClosedError(`${j.c} no longer lists “${j.t}”. It was removed from their careers board.`);
  if (!live.job) throw new Error(`Couldn’t reach ${j.c}’s careers board to confirm the vacancy (${live.note}). Try again in a minute.`);
  const raw = live.job;
  const now = new Date().toISOString();
  const country = detectCountry(raw.location, raw.countryHint);
  const arrangement: WorkArrangement = (['Remote', 'Hybrid', 'On-site'] as string[]).includes(raw.workplaceHint ?? '')
    ? (raw.workplaceHint as WorkArrangement)
    : detectArrangement(raw.location, raw.workplaceHint, raw.description.slice(0, 2000));
  const description = raw.description.slice(0, 30_000);
  const key = dedupeKey(raw.company, raw.title, raw.location, country);
  const job: Job = {
    id: jobIdFromKey(key),
    dedupeKey: key,
    title: raw.title,
    company: raw.company,
    companyWebsite: raw.companyWebsite,
    applicationUrl: raw.applicationUrl,
    sourceUrl: raw.sourceUrl,
    primarySource: raw.source,
    sources: [{ source: raw.source, sourceUrl: raw.sourceUrl, externalId: raw.externalId, board: board.token, lastSeenAt: now }],
    location: raw.location || (arrangement === 'Remote' ? 'Remote' : ''),
    country,
    employmentType: raw.employmentType,
    workArrangement: arrangement,
    salary: raw.salary,
    postedAt: raw.postedAt,
    postedDateSource: raw.postedDateSource,
    closingDate: raw.closingDate,
    description,
    ...jobDetailsFromText(description),
    sponsorship: classifySponsorship(description, country),
    verification: { status: 'Verified', checkedAt: now, method: `Listed on ${raw.company}'s ${SOURCE_LABELS[raw.source]} board (checked live when saved)`, note: null, httpStatus: 200 },
    lastVerifiedAt: now,
    firstSeenAt: now,
    lastSeenAt: now,
    closedAt: null,
    active: true,
    status: ctx.status,
    statusUpdatedAt: now,
    match: null,
  };
  const versions = ctx.resumes.map((r) => ({ id: r.id, name: r.name, text: r.text, profile: r.profile }));
  job.match = scoreAcrossVersions(job, versions, { requiresSponsorship: ctx.prefs.requiresSponsorship });
  await setDoc(paths.job(uid, job.id), JSON.parse(JSON.stringify(job)));
  // Track the employer's board so the scheduled refresh keeps re-verifying this vacancy.
  if (!ctx.prefs.boards.some((b) => b.source === board.source && b.token.toLowerCase() === board.token.toLowerCase())) {
    await savePreferences(uid, { ...ctx.prefs, boards: [...ctx.prefs.boards, board] }).catch(() => undefined);
  }
  return job;
}
