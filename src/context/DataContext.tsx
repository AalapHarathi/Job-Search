import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { onSnapshot, query, orderBy, limit } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { createNotifications, paths } from '@/lib/db';
import type { AppNotification, Application, Job, Preferences, RefreshMeta, ResumeVersion } from '@shared/types';
import { withDefaults } from '@shared/defaults';
import { daysUntil } from '@/lib/format';

interface DataState {
  ready: boolean;
  error: string | null;
  jobs: Job[];
  jobsById: Map<string, Job>;
  applications: Application[];
  appsByJob: Map<string, Application>;
  resumes: ResumeVersion[];
  primaryResume: ResumeVersion | null;
  prefs: Preferences;
  prefsSaved: boolean;
  notifications: AppNotification[];
  unread: number;
  refresh: Partial<RefreshMeta> | null;
}

const Ctx = createContext<DataState | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const uid = user!.uid;
  const [jobs, setJobs] = useState<Job[] | null>(null);
  const [applications, setApps] = useState<Application[] | null>(null);
  const [resumes, setResumes] = useState<ResumeVersion[] | null>(null);
  const [prefsRaw, setPrefs] = useState<Partial<Preferences> | null | undefined>(undefined);
  const [notifications, setNotifs] = useState<AppNotification[]>([]);
  const [refresh, setRefresh] = useState<Partial<RefreshMeta> | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const onErr = (e: Error) => setError(e.message.includes('permission') ? 'Firestore denied access. Deploy the security rules from firestore.rules (see FIREBASE_SETUP.md).' : e.message);
    const unsubs = [
      onSnapshot(paths.jobs(uid), (s) => setJobs(s.docs.map((d) => d.data() as Job)), onErr),
      onSnapshot(paths.applications(uid), (s) => setApps(s.docs.map((d) => d.data() as Application)), onErr),
      onSnapshot(paths.resumes(uid), (s) => setResumes(s.docs.map((d) => d.data() as ResumeVersion).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))), onErr),
      onSnapshot(paths.prefs(uid), (s) => setPrefs(s.exists() ? (s.data() as Preferences) : null), onErr),
      onSnapshot(query(paths.notifications(uid), orderBy('createdAt', 'desc'), limit(200)), (s) => setNotifs(s.docs.map((d) => d.data() as AppNotification)), onErr),
      onSnapshot(paths.refreshMeta(uid), (s) => setRefresh(s.exists() ? (s.data() as RefreshMeta) : null), onErr),
    ];
    return () => unsubs.forEach((u) => u());
  }, [uid]);

  const prefs = useMemo(() => withDefaults(prefsRaw ?? null), [prefsRaw]);
  const ready = jobs !== null && applications !== null && resumes !== null && prefsRaw !== undefined;

  // Time-based reminders are derived from your own data and written once (stable ids).
  const created = useRef(new Set<string>());
  useEffect(() => {
    if (!ready) return;
    const have = new Set(notifications.map((n) => n.id));
    const n = prefs.notifications;
    const items: { id: string; kind: string; title: string; body: string; jobId: string | null }[] = [];
    const jobsById = new Map(jobs!.map((j) => [j.id, j]));
    for (const a of applications!) {
      const job = jobsById.get(a.jobId);
      const live = job ? !['Rejected', 'Withdrawn', 'Not Interested', 'Offer Received'].includes(job.status) : true;
      const f = daysUntil(a.nextFollowUp);
      if (n.followUps && live && a.nextFollowUp && f !== null && f <= 1) {
        items.push({ id: `fu_${a.jobId}_${a.nextFollowUp}`, kind: 'follow_up', title: f < 0 ? `Follow-up overdue: ${a.company}` : `Follow up with ${a.company}`, body: `${a.title} — planned for ${a.nextFollowUp}.`, jobId: a.jobId });
      }
      const iv = daysUntil(a.interviewDate);
      if (n.interviews && a.interviewDate && iv !== null && iv >= 0 && iv <= 2) {
        items.push({ id: `iv_${a.jobId}_${a.interviewDate}`, kind: 'interview', title: `Interview ${iv === 0 ? 'today' : iv === 1 ? 'tomorrow' : 'in 2 days'}: ${a.company}`, body: `${a.title} on ${a.interviewDate}.`, jobId: a.jobId });
      }
    }
    if (n.closingSoon) for (const j of jobs!) {
      if (!j.active || !j.closingDate || !['Saved', 'Shortlisted', 'Ready to Apply'].includes(j.status)) continue;
      const d = daysUntil(j.closingDate);
      if (d !== null && d >= 0 && d <= 3) items.push({ id: `cs_${j.id}_${j.closingDate.slice(0, 10)}`, kind: 'closing_soon', title: `Closes ${d === 0 ? 'today' : `in ${d} day${d > 1 ? 's' : ''}`}: ${j.title}`, body: `${j.company} — apply before ${j.closingDate.slice(0, 10)}.`, jobId: j.id });
    }
    const fresh = items.filter((i) => !have.has(i.id) && !created.current.has(i.id));
    fresh.forEach((i) => created.current.add(i.id));
    if (fresh.length) createNotifications(uid, fresh).catch(console.error);
  }, [ready, jobs, applications, notifications, prefs, uid]);

  const value = useMemo<DataState>(() => {
    const js = jobs ?? [];
    const as = applications ?? [];
    const rs = resumes ?? [];
    return {
      ready, error,
      jobs: js,
      jobsById: new Map(js.map((j) => [j.id, j])),
      applications: as,
      appsByJob: new Map(as.map((a) => [a.jobId, a])),
      resumes: rs,
      primaryResume: rs.find((r) => r.isPrimary) ?? rs[0] ?? null,
      prefs,
      prefsSaved: !!prefsRaw,
      notifications,
      unread: notifications.filter((x) => !x.read).length,
      refresh,
    };
  }, [ready, error, jobs, applications, resumes, prefs, prefsRaw, notifications, refresh]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData outside provider');
  return c;
}
