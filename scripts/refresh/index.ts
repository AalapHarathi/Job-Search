/*
 * Scheduled discovery + verification job. Runs in GitHub Actions with the
 * Firebase Admin SDK. Never changes a user's application status.
 *
 *   REFRESH_MODE=full   daily run (default)
 *   REFRESH_MODE=queue  frequent cheap run: only processes users who pressed "Refresh jobs"
 */
import type { Firestore } from 'firebase-admin/firestore';
import { db } from './firebase';
import { pool } from './http';
import type { BoardFetch, RawJob, SourceReport } from './types';
import { fetchGreenhouse } from './sources/greenhouse';
import { fetchLever } from './sources/lever';
import { fetchAshby } from './sources/ashby';
import { fetchAdzuna, ADZUNA_COUNTRIES } from './sources/adzuna';
import { searchReed, enrichReed } from './sources/reed';
import { checkPage } from './verify';
import { aiJobAnalysis, aiResumeProfile, llmEnabled, llmModel } from './llm';
import { sendDigest } from './email';
import type { AppNotification, Application, BoardRef, Job, JobSourceRef, Preferences, RefreshMeta, ResumeVersion, SourceId, WorkArrangement } from '../../shared/types';
import { ATS_SOURCES, SOURCE_LABELS, SPONSORSHIP_LABELS } from '../../shared/types';
import { withDefaults } from '../../shared/defaults';
import { detectArrangement, detectCountry } from '../../shared/geo';
import { isRelevantTitle } from '../../shared/titles';
import { classifySponsorship } from '../../shared/sponsorship';
import { dedupeKey, jobIdFromKey, normCompany } from '../../shared/dedupe';
import { ENGINE_VERSION, jobDetailsFromText, scoreAcrossVersions, type ResumeInput } from '../../shared/matching';
import { ageDays } from '../../shared/freshness';
import { hash } from '../../shared/text';

const MODE = process.env.REFRESH_MODE === 'queue' ? 'queue' : 'full';
const DAILY_UTC_HOUR = 2;
const DAILY_UTC_MIN = 30;
const MAX_DESC = 30_000;
const SOURCE_PRIORITY: SourceId[] = ['greenhouse', 'lever', 'ashby', 'reed', 'adzuna'];

function nextScheduled(from = new Date()): string {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate(), DAILY_UTC_HOUR, DAILY_UTC_MIN));
  if (d <= from) d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString();
}

const isAts = (s: SourceId) => ATS_SOURCES.includes(s);
const log = (...a: unknown[]) => console.log(new Date().toISOString().slice(11, 19), ...a);

async function main() {
  const f = db();
  const owners = (process.env.OWNER_UIDS || '').split(',').map((s) => s.trim()).filter(Boolean);
  const uids = owners.length ? owners : (await f.collection('users').listDocuments()).map((d) => d.id);
  if (!uids.length) { log('No users found. Sign in to the dashboard once so your user document exists.'); return; }
  let failures = 0;
  for (const uid of uids) {
    try { await refreshUser(f, uid); }
    catch (e) { failures++; console.error(`User ${uid} failed:`, e); }
  }
  if (failures === uids.length) process.exitCode = 1;
}

async function refreshUser(f: Firestore, uid: string) {
  const userRef = f.collection('users').doc(uid);
  const metaRef = userRef.collection('meta').doc('refresh');
  const prevMeta = ((await metaRef.get()).data() ?? {}) as Partial<RefreshMeta>;

  if (MODE === 'queue') {
    const pending = prevMeta.requestedAt && (!prevMeta.lastAttemptAt || prevMeta.requestedAt > prevMeta.lastAttemptAt);
    if (!pending) { log(`[${uid}] no manual refresh requested — skipping`); return; }
  }

  const started = new Date();
  const nowIso = started.toISOString();
  await metaRef.set({ lastAttemptAt: nowIso, nextScheduledAt: nextScheduled(started) }, { merge: true });
  log(`[${uid}] refresh (${MODE}) started`);

  try {
    const prefs: Preferences = withDefaults((await userRef.collection('settings').doc('preferences').get()).data() as Partial<Preferences>);
    const resumes = (await userRef.collection('resumes').get()).docs.map((d) => d.data() as ResumeVersion);
    const existing = new Map<string, Job>((await userRef.collection('jobs').get()).docs.map((d) => [d.id, d.data() as Job]));
    const apps = (await userRef.collection('applications').get()).docs.map((d) => d.data() as Application);
    const notifIds = new Set((await userRef.collection('notifications').select().get()).docs.map((d) => d.id));
    const appliedCompanies = new Set(apps.map((a) => normCompany(a.company)));
    const enabled = new Set(prefs.countries.filter((c) => c.enabled).map((c) => c.code));
    const reports: Record<string, SourceReport> = {};
    const rep = (k: string) => (reports[k] ??= { ok: true, fetched: 0, errors: [] });

    // ---- 1. Employer ATS boards ------------------------------------------
    const boardFetches: BoardFetch[] = await pool(prefs.boards, 4, async (b: BoardRef) => {
      try {
        if (b.source === 'greenhouse') return await fetchGreenhouse(b);
        if (b.source === 'lever') return await fetchLever(b);
        return await fetchAshby(b);
      } catch (e) {
        return { board: b.token, source: b.source, ok: false, jobs: [], error: (e as Error).message };
      }
    });
    const boardOk = new Map<string, boolean>();
    for (const bf of boardFetches) {
      boardOk.set(`${bf.source}:${bf.board}`, bf.ok);
      const r = rep(bf.source);
      r.fetched += bf.jobs.length;
      if (!bf.ok) { r.errors.push(bf.error ?? `${bf.board}: failed`); }
    }
    let raw: RawJob[] = boardFetches.flatMap((b) => b.jobs);

    // ---- 2. Aggregators ----------------------------------------------------
    const countriesByPriority = [...prefs.countries].filter((c) => c.enabled).sort((a, b) => a.priority - b.priority).map((c) => c.code);
    const titles = prefs.targetTitles.filter(Boolean);
    const az = { id: process.env.ADZUNA_APP_ID || '', key: process.env.ADZUNA_APP_KEY || '' };
    if (prefs.aggregators.adzuna) {
      const r = rep('adzuna');
      if (!az.id || !az.key) { r.ok = false; r.errors.push('ADZUNA_APP_ID / ADZUNA_APP_KEY not configured'); }
      else {
        const queries: [string, string][] = [];
        for (const t of titles) for (const c of countriesByPriority) if (ADZUNA_COUNTRIES[c]) queries.push([c, t]);
        // round-robin across titles so the query cap doesn't starve lower-priority titles
        queries.sort((a, b) => titles.indexOf(a[1]) - titles.indexOf(b[1]) || countriesByPriority.indexOf(a[0]) - countriesByPriority.indexOf(b[0]));
        for (const [c, t] of queries.slice(0, prefs.maxQueriesPerSource)) {
          const res = await fetchAdzuna(c, t, az);
          if (res.error) r.errors.push(res.error);
          r.fetched += res.jobs.length;
          raw.push(...res.jobs);
        }
      }
    }
    const reedKey = process.env.REED_API_KEY || '';
    if (prefs.aggregators.reed && enabled.has('GB')) {
      const r = rep('reed');
      if (!reedKey) { r.ok = false; r.errors.push('REED_API_KEY not configured'); }
      else {
        const found: RawJob[] = [];
        for (const t of titles.slice(0, prefs.maxQueriesPerSource)) {
          const res = await searchReed(t, reedKey);
          if (res.error) r.errors.push(res.error);
          found.push(...res.jobs);
        }
        const relevant = found.filter((j) => isRelevantTitle(j.title, prefs.excludeTitleKeywords));
        const unique = [...new Map(relevant.map((j) => [j.externalId, j])).values()];
        const enrichIds = new Set(unique.filter((j) => !existing.has(jobIdFromKey(dedupeKey(j.company, j.title, j.location, 'GB')))).slice(0, 60).map((j) => j.externalId));
        const enriched = await pool(unique, 3, (j) => (enrichIds.has(j.externalId) ? enrichReed(j, reedKey) : Promise.resolve(j)));
        r.fetched += enriched.length;
        raw.push(...enriched);
      }
    }
    for (const r of Object.values(reports)) if (r.errors.length && r.fetched === 0) r.ok = false;

    // ---- 3. Normalise + filter --------------------------------------------
    interface Cand { raw: RawJob; country: string | null; arrangement: WorkArrangement; key: string }
    const cands: Cand[] = [];
    for (const j of raw) {
      if (!j.title || !isRelevantTitle(j.title, prefs.excludeTitleKeywords)) continue;
      const country = detectCountry(j.location, j.countryHint);
      const arrangement = (j.workplaceHint as WorkArrangement | null) && ['Remote', 'Hybrid', 'On-site'].includes(j.workplaceHint!)
        ? (j.workplaceHint as WorkArrangement)
        : detectArrangement(j.location, j.workplaceHint, j.description.slice(0, 2000));
      if (country && !enabled.has(country)) continue;
      if (!country && arrangement !== 'Remote') continue;
      const age = ageDays(j.postedAt);
      if (!isAts(j.source) && age !== null && age > 30) continue;
      cands.push({ raw: j, country, arrangement, key: dedupeKey(j.company, j.title, j.location, country) });
    }

    // ---- 4. Deduplicate + merge across sources ------------------------------
    const groups = new Map<string, Cand[]>();
    for (const c of cands) (groups.get(c.key) ?? groups.set(c.key, []).get(c.key)!).push(c);

    const seen = new Set<string>();
    const out = new Map<string, Job>();
    const newIds = new Set<string>();
    const pageChecks: { id: string; url: string; atsListed: boolean }[] = [];

    for (const [key, group] of groups) {
      group.sort((a, b) => SOURCE_PRIORITY.indexOf(a.raw.source) - SOURCE_PRIORITY.indexOf(b.raw.source));
      const primary = group[0];
      const id = jobIdFromKey(key);
      seen.add(id);
      const prev = existing.get(id);
      const atsItem = group.find((g) => isAts(g.raw.source));
      const description = (atsItem?.raw.description || group.map((g) => g.raw.description).sort((a, b) => b.length - a.length)[0] || '').slice(0, MAX_DESC);
      const applicationUrl = atsItem?.raw.applicationUrl ?? group.find((g) => g.raw.applicationUrl)?.raw.applicationUrl ?? null;
      const datedItem = group.find((g) => g.raw.postedAt);
      const sourcesNow: JobSourceRef[] = group.map((g) => ({ source: g.raw.source, sourceUrl: g.raw.sourceUrl, externalId: g.raw.externalId, board: g.raw.board, lastSeenAt: nowIso }));
      const mergedSources = mergeSources(prev?.sources ?? [], sourcesNow);
      const country = primary.country ?? group.find((g) => g.country)?.country ?? null;
      const details = jobDetailsFromText(description);
      const closingDate = group.find((g) => g.raw.closingDate)?.raw.closingDate ?? null;
      const closedByDate = !!closingDate && Date.parse(closingDate) < startOfDay(started);

      const job: Job = {
        id,
        dedupeKey: key,
        title: primary.raw.title,
        company: atsItem?.raw.company ?? primary.raw.company,
        companyWebsite: group.find((g) => g.raw.companyWebsite)?.raw.companyWebsite ?? prev?.companyWebsite ?? null,
        applicationUrl,
        sourceUrl: primary.raw.sourceUrl,
        primarySource: primary.raw.source,
        sources: mergedSources,
        location: primary.raw.location || (primary.arrangement === 'Remote' ? 'Remote' : ''),
        country,
        employmentType: group.find((g) => g.raw.employmentType)?.raw.employmentType ?? null,
        workArrangement: primary.arrangement !== 'Unknown' ? primary.arrangement : group.find((g) => g.arrangement !== 'Unknown')?.arrangement ?? 'Unknown',
        salary: group.find((g) => g.raw.salary)?.raw.salary ?? null,
        postedAt: datedItem?.raw.postedAt ?? prev?.postedAt ?? null,
        postedDateSource: datedItem?.raw.postedDateSource ?? prev?.postedDateSource ?? null,
        closingDate,
        description,
        ...details,
        sponsorship: classifySponsorship(description, country),
        verification: atsItem
          ? { status: 'Verified', checkedAt: nowIso, method: `Listed on ${atsItem.raw.company}'s ${SOURCE_LABELS[atsItem.raw.source]} board`, note: null, httpStatus: 200 }
          : { status: 'Unverified', checkedAt: nowIso, method: `Found on ${SOURCE_LABELS[primary.raw.source]}`, note: 'Employer’s own listing not confirmed', httpStatus: null },
        lastVerifiedAt: atsItem ? nowIso : prev?.lastVerifiedAt ?? null,
        firstSeenAt: prev?.firstSeenAt ?? nowIso,
        lastSeenAt: nowIso,
        closedAt: null,
        active: true,
        status: prev?.status ?? 'Discovered',
        statusUpdatedAt: prev?.statusUpdatedAt ?? nowIso,
        match: prev?.match ?? null,
      };
      if (closedByDate) closeJob(job, nowIso, 'Closing date has passed', 'closing date');
      if (!prev) newIds.add(id);

      const tracked = prev && ['Saved', 'Shortlisted', 'Ready to Apply'].includes(prev.status);
      const staleCheck = !prev || !prev.verification?.checkedAt || (ageDays(prev.verification.checkedAt) ?? 99) >= 3 || tracked;
      if (!closedByDate && staleCheck) {
        const url = applicationUrl ?? primary.raw.sourceUrl;
        pageChecks.push({ id, url, atsListed: !!atsItem });
      }
      out.set(id, job);
    }

    // ---- 5. Page verification -----------------------------------------------
    pageChecks.sort((a, b) => Number(newIds.has(b.id)) - Number(newIds.has(a.id)));
    const checks = pageChecks.slice(0, 200);
    await pool(checks, 4, async (c) => {
      const job = out.get(c.id)!;
      const res = await checkPage(c.url);
      if (res.state === 'closed') closeJob(job, nowIso, res.note, 'page check', res.httpStatus);
      else if (c.atsListed) {
        job.verification = { ...job.verification, httpStatus: res.httpStatus, note: res.state === 'unknown' ? `Listed on employer board; ${res.note}` : null };
      } else {
        job.verification = { status: 'Unverified', checkedAt: nowIso, method: job.verification.method, httpStatus: res.httpStatus, note: res.state === 'open' ? 'Job-board page is live; employer’s own listing not confirmed' : res.note };
      }
    });

    // ---- 6. Previously stored jobs that were not returned this run ----------
    const trackedBoards = new Set(prefs.boards.map((b) => `${b.source}:${b.token}`));
    const unseen = [...existing.values()].filter((j) => !seen.has(j.id) && j.verification?.status !== 'Closed');
    const aggregatorRechecks: Job[] = [];
    for (const prev of unseen) {
      const job: Job = { ...prev };
      const atsRef = prev.sources.find((s) => isAts(s.source));
      if (atsRef) {
        const k = `${atsRef.source}:${atsRef.board}`;
        if (!trackedBoards.has(k)) {
          job.verification = { ...prev.verification, status: 'Unverified', checkedAt: nowIso, note: 'Company board is no longer tracked in your preferences' };
        } else if (boardOk.get(k)) {
          closeJob(job, nowIso, 'No longer listed on the employer’s board', 'employer board');
        } else {
          job.verification = { ...prev.verification, status: 'Unverified', checkedAt: nowIso, note: 'Employer board could not be reached this run' };
        }
        out.set(job.id, job);
      } else {
        aggregatorRechecks.push(job);
      }
    }
    aggregatorRechecks.sort((a, b) => Number(['Saved', 'Shortlisted', 'Ready to Apply'].includes(b.status)) - Number(['Saved', 'Shortlisted', 'Ready to Apply'].includes(a.status)));
    await pool(aggregatorRechecks.slice(0, 80), 4, async (job) => {
      const url = job.applicationUrl ?? job.sourceUrl;
      const res = await checkPage(url);
      if (res.state === 'closed') closeJob(job, nowIso, res.note, 'page check', res.httpStatus);
      else job.verification = { status: 'Unverified', checkedAt: nowIso, method: job.verification.method, httpStatus: res.httpStatus, note: 'Not returned by the latest search; page still reachable' };
      out.set(job.id, job);
    });
    for (const job of aggregatorRechecks.slice(80)) {
      job.verification = { ...job.verification, status: 'Unverified', checkedAt: nowIso, note: 'Not returned by the latest search' };
      out.set(job.id, job);
    }
    for (const job of out.values()) {
      if (job.verification.status !== 'Closed' && !job.sources.some((s) => isAts(s.source)) && (ageDays(job.postedAt) ?? 0) > 45) job.active = false;
    }

    // ---- 7. Resume matching ---------------------------------------------------
    const versions: ResumeInput[] = resumes.map((r) => ({ id: r.id, name: r.name, text: r.text, profile: r.profile }));
    const latestResume = resumes.reduce((m, r) => (r.updatedAt > m ? r.updatedAt : m), '');
    for (const job of out.values()) {
      if (!versions.length) { job.match = null; continue; }
      const prev = existing.get(job.id);
      const needs = !job.match || job.match.engine !== ENGINE_VERSION || job.match.computedAt < latestResume
        || (prev && hash(prev.description) !== hash(job.description)) || prev?.sponsorship?.category !== job.sponsorship.category
        || Object.keys(job.match.perVersion ?? {}).length !== versions.length;
      if (needs) {
        const keepAi = job.match?.aiAnalysis && job.match.computedAt >= latestResume && prev && hash(prev.description) === hash(job.description) ? job.match.aiAnalysis : null;
        job.match = scoreAcrossVersions(job, versions, { requiresSponsorship: prefs.requiresSponsorship, now: started });
        if (job.match) job.match.aiAnalysis = keepAi;
      }
    }

    // ---- 8. Optional LLM enrichment -------------------------------------------
    if (llmEnabled() && versions.length) {
      const maxJobs = Number(process.env.LLM_MAX_JOBS_PER_RUN || 20);
      const targets = [...out.values()]
        .filter((j) => j.active && j.match && j.match.score >= 65 && !j.match.aiAnalysis)
        .sort((a, b) => b.match!.score - a.match!.score)
        .slice(0, maxJobs);
      for (const j of targets) {
        const v = resumes.find((r) => r.id === j.match!.resumeVersionId) ?? resumes[0];
        try {
          const a = await aiJobAnalysis({ resumeText: v.text, jobTitle: j.title, company: j.company, description: j.description, sponsorshipLabel: SPONSORSHIP_LABELS[j.sponsorship.category], score: j.match!.score });
          j.match!.aiAnalysis = { ...a, model: llmModel(), generatedAt: nowIso };
        } catch (e) { rep('llm').errors.push((e as Error).message); }
      }
      for (const r of resumes) {
        if (r.aiProfile?.textHash === r.textHash) continue;
        try {
          const p = await aiResumeProfile(r.text, r.profile);
          await userRef.collection('resumes').doc(r.id).update({ aiProfile: { ...p, model: llmModel(), generatedAt: nowIso, textHash: r.textHash } });
        } catch (e) { rep('llm').errors.push((e as Error).message); }
      }
    }

    // ---- 9. Write ---------------------------------------------------------------
    const writer = f.bulkWriter();
    let closedCount = 0;
    for (const job of out.values()) {
      const prev = existing.get(job.id);
      const ref = userRef.collection('jobs').doc(job.id);
      if (!prev) { writer.set(ref, job); continue; }
      if (prev.verification?.status !== 'Closed' && job.verification.status === 'Closed') closedCount++;
      // Never touch user-owned fields on existing documents.
      const { status: _s, statusUpdatedAt: _u, ...discovery } = job;
      writer.set(ref, discovery, { merge: true });
    }

    // ---- 10. Notifications -------------------------------------------------------
    const n = prefs.notifications;
    const digest: { title: string; body: string }[] = [];
    const notify = (id: string, data: Omit<AppNotification, 'id' | 'createdAt' | 'read'>) => {
      if (notifIds.has(id)) return;
      notifIds.add(id);
      digest.push({ title: data.title, body: data.body });
      writer.set(userRef.collection('notifications').doc(id), { ...data, id, createdAt: nowIso, read: false });
    };
    for (const job of out.values()) {
      const prev = existing.get(job.id);
      if (!prev && job.active && n.newExcellent && (job.match?.score ?? 0) >= n.excellentThreshold) {
        notify(`new_${job.id}`, { kind: 'new_excellent', title: `${job.match!.score}% match: ${job.title}`, body: `${job.company} · ${job.location || job.country || 'Remote'}`, jobId: job.id });
      }
      if (!prev && job.active && n.previouslyAppliedCompanies && appliedCompanies.has(normCompany(job.company))) {
        notify(`co_${job.id}`, { kind: 'company_new_job', title: `New opening at ${job.company}`, body: `${job.title} — you’ve applied here before.`, jobId: job.id });
      }
      if (prev && n.savedUnavailable && prev.verification?.status !== 'Closed' && job.verification.status === 'Closed' && ['Saved', 'Shortlisted', 'Ready to Apply'].includes(prev.status)) {
        notify(`closed_${job.id}`, { kind: 'saved_unavailable', title: `No longer available: ${job.title}`, body: `${job.company} — ${job.verification.note ?? 'listing closed'}.`, jobId: job.id });
      }
    }

    const all = [...existing.values()].map((j) => out.get(j.id) ?? j).concat([...newIds].map((id) => out.get(id)!));
    const activeJobs = all.filter((j) => j.active && j.verification?.status !== 'Closed');
    const anyErrors = Object.values(reports).some((r) => r.errors.length);
    const meta: RefreshMeta = {
      lastAttemptAt: nowIso,
      lastSuccessAt: nowIso,
      lastStatus: anyErrors ? 'partial' : 'success',
      lastError: anyErrors ? Object.entries(reports).flatMap(([k, r]) => r.errors.map((e) => `${k}: ${e}`)).slice(0, 12).join('\n') : null,
      nextScheduledAt: nextScheduled(started),
      newJobs: newIds.size,
      closedJobs: closedCount,
      unverified: activeJobs.filter((j) => j.verification.status === 'Unverified').length,
      totalActive: activeJobs.length,
      sources: reports,
      requestedAt: null,
    };
    writer.set(metaRef, meta);
    writer.set(userRef.collection('refreshRuns').doc(nowIso.replace(/[:.]/g, '-')), { ...meta, mode: MODE, durationMs: Date.now() - started.getTime() });
    await writer.close();
    try { await sendDigest(digest, process.env.DASHBOARD_URL || null); }
    catch (e) { console.warn('Email digest failed:', (e as Error).message); }
    log(`[${uid}] done: ${newIds.size} new, ${closedCount} closed, ${meta.unverified} unverified, ${meta.totalActive} active`);
  } catch (e) {
    await metaRef.set({ lastStatus: 'failed', lastError: (e as Error).message.slice(0, 500), requestedAt: null }, { merge: true });
    throw e;
  }
}

function closeJob(job: Job, nowIso: string, note: string | null, method: string, httpStatus: number | null = null) {
  job.verification = { status: 'Closed', checkedAt: nowIso, method, note, httpStatus };
  job.active = false;
  job.closedAt = job.closedAt ?? nowIso;
}

function mergeSources(prev: JobSourceRef[], now: JobSourceRef[]): JobSourceRef[] {
  const m = new Map(prev.map((s) => [`${s.source}:${s.externalId}`, s]));
  for (const s of now) m.set(`${s.source}:${s.externalId}`, s);
  return [...m.values()].sort((a, b) => SOURCE_PRIORITY.indexOf(a.source) - SOURCE_PRIORITY.indexOf(b.source));
}

function startOfDay(d: Date) { return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()); }

main().catch((e) => { console.error(e); process.exit(1); });
