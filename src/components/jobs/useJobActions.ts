import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useUI } from '@/context/UIContext';
import { setJobStatus } from '@/lib/db';
import type { ApplicationStatus, Job } from '@shared/types';

export function useJobActions() {
  const { user } = useAuth();
  const { prefs, appsByJob } = useData();
  const { toast, openApply } = useUI();
  const setStatus = async (job: Job, status: ApplicationStatus) => {
    if (status === 'Applied' && !appsByJob.has(job.id)) { openApply(job.id); return; }
    try {
      await setJobStatus(user!.uid, job, status, { notify: prefs.notifications.statusChanges });
      toast(`Moved to ${status}`);
    } catch (e) { toast((e as Error).message, 'error'); }
  };
  return {
    setStatus,
    toggleSave: (job: Job) => setStatus(job, job.status === 'Saved' ? 'Discovered' : 'Saved'),
    markApplied: (job: Job) => (appsByJob.has(job.id) ? toast('Already marked as applied.', 'error') : openApply(job.id)),
  };
}
