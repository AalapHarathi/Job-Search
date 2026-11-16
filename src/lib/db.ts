import {
  arrayUnion, collection, deleteDoc, doc, getDoc, getDocs, runTransaction, setDoc, updateDoc, writeBatch,
} from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { getDb } from './firebase';
import type { Application, ApplicationStatus, Job, Preferences, ResumeProfile, ResumeVersion } from '@shared/types';
import { scoreAcrossVersions, type ResumeInput } from '@shared/matching';
import { hash } from '@shared/text';
import * as V from './validate';

const u = (uid: string) => doc(getDb(), 'users', uid);
export const paths = {
  jobs: (uid: string) => collection(u(uid), 'jobs'),
  job: (uid: string, id: string) => doc(u(uid), 'jobs', id),
  applications: (uid: string) => collection(u(uid), 'applications'),
  application: (uid: string, jobId: string) => doc(u(uid), 'applications', jobId),
  resumes: (uid: string) => collection(u(uid), 'resumes'),
  resume: (uid: string, id: string) => doc(u(uid), 'resumes', id),
  resumeFile: (uid: string, id: string) => doc(u(uid), 'resumeFiles', id),
  prefs: (uid: string) => doc(u(uid), 'settings', 'preferences'),
  notifications: (uid: string) => collection(u(uid), 'notifications'),
  notification: (uid: string, id: string) => doc(u(uid), 'notifications', id),
  refreshMeta: (uid: string) => doc(u(uid), 'meta', 'refresh'),
};

export async function ensureUserDoc(user: User) {
  const ref = u(user.uid);
  const snap = await getDoc(ref);
  const now = new Date().toISOString();
  if (!snap.exists()) await setDoc(ref, { email: user.email ?? null, displayName: user.displayName ?? null, createdAt: now, lastLoginAt: now });
  else await updateDoc(ref, { lastLoginAt: now });
}

export async function savePreferences(uid: string, p: Preferences) {
  if (p.targetTitles.some((t) => t.length > 80)) throw new V.ValidationError('Job titles must be under 80 characters.');
  if (p.boards.some((b) => !/^[a-z0-9:_.-]{1,80}$/i.test(b.token))) throw new V.ValidationError('Board identifiers can only contain letters, numbers, dashes, dots and underscores.');
  if (p.minRecommendedScore < 0 || p.minRecommendedScore > 100) throw new V.ValidationError('Minimum score must be between 0 and 100.');
  await setDoc(paths.prefs(uid), { ...p, updatedAt: new Date().toISOString() });
}

export async function setJobStatus(uid: string, job: Job, status: ApplicationStatus, opts: { note?: string; notify?: boolean } = {}) {
  V.status(status);
  const now = new Date().toISOString();
  const batch = writeBatch(getDb());
  batch.update(paths.job(uid, job.id), { status, statusUpdatedAt: now });
  const appRef = paths.application(uid, job.id);
  const app = await getDoc(appRef);
  if (app.exists()) batch.update(appRef, { history: arrayUnion({ status, at: now, note: opts.note ?? null }), updatedAt: now });
  if (opts.notify && job.status !== status) {
    const id = `st_${job.id}_${Date.now()}`;
    batch.set(paths.notification(uid, id), {
      id, kind: 'status_change', title: `${job.title}: ${status}`, body: `${job.company} — moved from ${job.status} to ${status}.`, jobId: job.id, createdAt: now, read: false,
    });
  }
  await batch.commit();
}

export class DuplicateApplicationError extends Error {}

export interface ApplyForm {
  appliedDate: string; company: string; title: string; applicationUrl: string; resumeVersionId: string | null;
  resumeVersionName: string | null; notes: string; referral: string; nextFollowUp: string;
}

export async function markApplied(uid: string, job: Job, form: ApplyForm) {
  const data = {
    appliedDate: V.dateOnly(form.appliedDate, 'Application date', true)!,
    company: V.reqString(form.company, 'Company', 200),
    title: V.reqString(form.title, 'Job title', 200),
    applicationUrl: V.url(form.applicationUrl, 'Application URL'),
    notes: V.optString(form.notes, 'Notes', 5000),
    referral: V.optString(form.referral, 'Referral', 500),
    nextFollowUp: V.dateOnly(form.nextFollowUp, 'Follow-up date'),
  };
  const now = new Date().toISOString();
  await runTransaction(getDb(), async (tx) => {
    const appRef = paths.application(uid, job.id);
    const existing = await tx.get(appRef);
    if (existing.exists()) throw new DuplicateApplicationError('You have already recorded an application for this vacancy.');
    const app: Application = {
      jobId: job.id, ...data, resumeVersionId: form.resumeVersionId, resumeVersionName: form.resumeVersionName,
      interviewDate: null, country: job.country, matchScore: job.match?.score ?? null, createdAt: now, updatedAt: now,
      history: [{ status: 'Applied', at: now, note: null }],
    };
    tx.set(appRef, app);
    tx.update(paths.job(uid, job.id), { status: 'Applied', statusUpdatedAt: now });
  });
}

export async function updateApplication(uid: string, jobId: string, patch: Partial<Pick<Application, 'notes' | 'referral' | 'nextFollowUp' | 'interviewDate' | 'appliedDate' | 'resumeVersionId' | 'resumeVersionName'>>) {
  const clean: Record<string, string | null> = { updatedAt: new Date().toISOString() };
  if ('notes' in patch) clean.notes = V.optString(patch.notes, 'Notes', 5000);
  if ('referral' in patch) clean.referral = V.optString(patch.referral, 'Referral', 500);
  if ('nextFollowUp' in patch) clean.nextFollowUp = V.dateOnly(patch.nextFollowUp, 'Follow-up date');
  if ('interviewDate' in patch) clean.interviewDate = V.dateOnly(patch.interviewDate, 'Interview date');
  if ('appliedDate' in patch) clean.appliedDate = V.dateOnly(patch.appliedDate, 'Application date', true);
  if ('resumeVersionId' in patch) { clean.resumeVersionId = patch.resumeVersionId ?? null; clean.resumeVersionName = patch.resumeVersionName ?? null; }
  await updateDoc(paths.application(uid, jobId), clean);
}

export async function deleteApplication(uid: string, job: Job) {
  const batch = writeBatch(getDb());
  batch.delete(paths.application(uid, job.id));
  batch.update(paths.job(uid, job.id), { status: 'Saved', statusUpdatedAt: new Date().toISOString() });
  await batch.commit();
}

// ---- Resumes ---------------------------------------------------------------
const MAX_STORED_FILE = 700 * 1024; // keeps the base64 copy under Firestore's 1 MiB document limit

export async function saveResume(uid: string, input: { name: string; file: File; text: string; type: 'pdf' | 'docx'; profile: ResumeProfile; base64: string | null; makePrimary: boolean; replaceId?: string }) {
  const now = new Date().toISOString();
  const id = input.replaceId ?? `r_${Date.now().toString(36)}`;
  const existing = await getDocs(paths.resumes(uid));
  const isFirst = existing.empty;
  const batch = writeBatch(getDb());
  const prev = input.replaceId ? existing.docs.find((d) => d.id === input.replaceId)?.data() as ResumeVersion | undefined : undefined;
  const storeFile = !!input.base64 && input.file.size <= MAX_STORED_FILE;
  const version: ResumeVersion = {
    id,
    name: V.reqString(input.name, 'Version name', 80),
    fileName: input.file.name.slice(0, 200),
    fileType: input.type,
    fileSize: input.file.size,
    hasStoredFile: storeFile,
    text: input.text.slice(0, 60_000),
    textHash: hash(input.text),
    profile: input.profile,
    aiProfile: null,
    isPrimary: isFirst || input.makePrimary || !!prev?.isPrimary,
    createdAt: prev?.createdAt ?? now,
    updatedAt: now,
  };
  if (version.isPrimary) existing.docs.forEach((d) => { if (d.id !== id && (d.data() as ResumeVersion).isPrimary) batch.update(d.ref, { isPrimary: false }); });
  batch.set(paths.resume(uid, id), version);
  if (storeFile) batch.set(paths.resumeFile(uid, id), { data: input.base64, mime: input.file.type || (input.type === 'pdf' ? 'application/pdf' : 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'), name: input.file.name.slice(0, 200), size: input.file.size });
  else batch.delete(paths.resumeFile(uid, id));
  await batch.commit();
  return version;
}

export async function updateResumeProfile(uid: string, id: string, profile: ResumeProfile) {
  if (profile.skills.length > 200) throw new V.ValidationError('Too many skills.');
  await updateDoc(paths.resume(uid, id), { profile, updatedAt: new Date().toISOString() });
}

export async function renameResume(uid: string, id: string, name: string) {
  await updateDoc(paths.resume(uid, id), { name: V.reqString(name, 'Version name', 80), updatedAt: new Date().toISOString() });
}

export async function setPrimaryResume(uid: string, id: string, all: ResumeVersion[]) {
  const batch = writeBatch(getDb());
  all.forEach((r) => batch.update(paths.resume(uid, r.id), { isPrimary: r.id === id }));
  await batch.commit();
}

export async function deleteResume(uid: string, r: ResumeVersion, all: ResumeVersion[]) {
  const batch = writeBatch(getDb());
  batch.delete(paths.resume(uid, r.id));
  batch.delete(paths.resumeFile(uid, r.id));
  const rest = all.filter((x) => x.id !== r.id);
  if (r.isPrimary && rest.length) batch.update(paths.resume(uid, rest[0].id), { isPrimary: true });
  await batch.commit();
}

export async function getResumeFile(uid: string, id: string): Promise<{ data: string; mime: string; name: string } | null> {
  const s = await getDoc(paths.resumeFile(uid, id));
  return s.exists() ? (s.data() as { data: string; mime: string; name: string }) : null;
}

/** Re-score every stored vacancy in the browser (same engine as the refresh job). */
export async function rescoreJobs(uid: string, jobs: Job[], resumes: ResumeVersion[], requiresSponsorship: boolean, onProgress?: (done: number, total: number) => void) {
  const versions: ResumeInput[] = resumes.map((r) => ({ id: r.id, name: r.name, text: r.text, profile: r.profile }));
  const now = new Date();
  for (let i = 0; i < jobs.length; i += 400) {
    const batch = writeBatch(getDb());
    for (const j of jobs.slice(i, i + 400)) {
      const match = versions.length ? scoreAcrossVersions(j, versions, { requiresSponsorship, now }) : null;
      batch.update(paths.job(uid, j.id), { match });
    }
    await batch.commit();
    onProgress?.(Math.min(i + 400, jobs.length), jobs.length);
  }
}

// ---- Refresh + notifications ---------------------------------------------
export async function requestRefresh(uid: string) {
  await setDoc(paths.refreshMeta(uid), { requestedAt: new Date().toISOString() }, { merge: true });
}

export async function markNotificationRead(uid: string, id: string, read = true) {
  await updateDoc(paths.notification(uid, id), { read });
}
export async function markAllNotificationsRead(uid: string, ids: string[]) {
  for (let i = 0; i < ids.length; i += 400) {
    const b = writeBatch(getDb());
    ids.slice(i, i + 400).forEach((id) => b.update(paths.notification(uid, id), { read: true }));
    await b.commit();
  }
}
export async function deleteNotification(uid: string, id: string) {
  await deleteDoc(paths.notification(uid, id));
}
export async function createNotifications(uid: string, items: { id: string; kind: string; title: string; body: string; jobId: string | null }[]) {
  if (!items.length) return;
  const b = writeBatch(getDb());
  const now = new Date().toISOString();
  items.slice(0, 400).forEach((n) => b.set(paths.notification(uid, n.id), { ...n, createdAt: now, read: false }));
  await b.commit();
}

export async function exportAll(uid: string) {
  const [jobs, apps, resumes, prefs] = await Promise.all([
    getDocs(paths.jobs(uid)), getDocs(paths.applications(uid)), getDocs(paths.resumes(uid)), getDoc(paths.prefs(uid)),
  ]);
  return {
    exportedAt: new Date().toISOString(),
    preferences: prefs.data() ?? null,
    resumes: resumes.docs.map((d) => d.data()),
    applications: apps.docs.map((d) => d.data()),
    jobs: jobs.docs.map((d) => d.data()),
  };
}
