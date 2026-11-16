import { RefreshCw, AlertTriangle, ExternalLink } from 'lucide-react';
import { useState } from 'react';
import clsx from 'clsx';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { requestRefresh } from '@/lib/db';
import { fmtDate, fmtDateTimeRel } from '@/lib/format';
import { refreshWorkflowUrl } from '@/lib/config';
import { Button } from '@/components/ui';

/** Compact status for the top bar. No "live" indicator — only real timestamps. */
export function RefreshPill() {
  const { refresh } = useData();
  const failed = refresh?.lastStatus === 'failed';
  return (
    <span className={clsx('hidden md:inline-flex items-center gap-1.5 text-xs', failed ? 'text-bad' : 'text-muted')} title={refresh?.lastSuccessAt ? `Last successful refresh: ${fmtDate(refresh.lastSuccessAt, true)}` : 'No successful refresh yet'}>
      {failed && <AlertTriangle className="size-3.5" />}
      {refresh?.lastSuccessAt ? `Updated ${fmtDateTimeRel(refresh.lastSuccessAt)}` : 'Not refreshed yet'}
    </span>
  );
}

export function RefreshPanel() {
  const { refresh } = useData();
  const { user } = useAuth();
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const pending = !!refresh?.requestedAt && (!refresh.lastAttemptAt || refresh.requestedAt > refresh.lastAttemptAt);
  const ask = async () => {
    setBusy(true);
    try { await requestRefresh(user!.uid); toast('Refresh requested. It runs at the next queue check (within 3 hours), or start it now on GitHub.'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setBusy(false); }
  };
  const failed = refresh?.lastStatus === 'failed';
  const partial = refresh?.lastStatus === 'partial';
  const stats: [string, string | number][] = [
    ['Last successful refresh', refresh?.lastSuccessAt ? fmtDate(refresh.lastSuccessAt, true) : 'Never'],
    ['Next scheduled refresh', refresh?.nextScheduledAt ? fmtDate(refresh.nextScheduledAt, true) : 'Daily at 08:00 IST once set up'],
    ['New jobs found', refresh?.newJobs ?? '—'],
    ['Jobs closed', refresh?.closedJobs ?? '—'],
    ['Unverified listings', refresh?.unverified ?? '—'],
  ];
  return (
    <div>
      {failed && (
        <div role="alert" className="mb-3 rounded-lg border border-bad/30 bg-bad/5 p-3 text-sm">
          <p className="font-medium text-bad flex items-center gap-1.5"><AlertTriangle className="size-4" />Last refresh failed {refresh?.lastAttemptAt ? fmtDateTimeRel(refresh.lastAttemptAt) : ''}</p>
          <p className="text-muted mt-1 whitespace-pre-line">{refresh?.lastError}</p>
          <p className="text-muted mt-1">Data shown is from the last successful refresh{refresh?.lastSuccessAt ? ` (${fmtDate(refresh.lastSuccessAt, true)})` : ''}.</p>
        </div>
      )}
      {partial && refresh?.lastError && (
        <details className="mb-3 rounded-lg border border-warn/30 bg-warn/5 p-3 text-sm">
          <summary className="cursor-pointer text-warn font-medium">Some sources had problems in the last run</summary>
          <p className="text-muted mt-2 whitespace-pre-line text-xs">{refresh.lastError}</p>
        </details>
      )}
      <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
        {stats.map(([k, v]) => <div key={k}><dt className="text-xs text-muted">{k}</dt><dd className="text-sm num mt-0.5">{v}</dd></div>)}
      </dl>
      <div className="mt-4 flex flex-wrap gap-2">
        <Button onClick={ask} loading={busy} disabled={pending}><RefreshCw className="size-4" />{pending ? 'Refresh queued' : 'Refresh jobs'}</Button>
        {refreshWorkflowUrl && <a href={refreshWorkflowUrl} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 px-3 text-sm text-accent hover:underline">Run now on GitHub<ExternalLink className="size-3.5" /></a>}
      </div>
    </div>
  );
}
