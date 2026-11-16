import { useState } from 'react';
import { Download, LogOut, KeyRound } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useData } from '@/context/DataContext';
import { useTheme } from '@/context/ThemeContext';
import { useUI } from '@/context/UIContext';
import { PageHeader, Section, Button, Toggle, Input, Field } from '@/components/ui';
import { RefreshPanel } from '@/components/layout/RefreshStatus';
import { exportAll, savePreferences } from '@/lib/db';
import { downloadBlob } from '@/lib/format';
import type { NotificationPrefs } from '@shared/types';

export function Settings() {
  const { user, logout, resetPassword } = useAuth();
  const { prefs } = useData();
  const { theme, set } = useTheme();
  const { toast } = useUI();
  const [busy, setBusy] = useState(false);
  const n = prefs.notifications;
  const setN = async (patch: Partial<NotificationPrefs>) => {
    try { await savePreferences(user!.uid, { ...prefs, notifications: { ...n, ...patch } }); }
    catch (e) { toast((e as Error).message, 'error'); }
  };
  const isPasswordUser = user?.providerData.some((p) => p.providerId === 'password');

  return (
    <div className="space-y-6 max-w-3xl">
      <PageHeader title="Settings" />

      <Section title="Job refresh"><RefreshPanel /></Section>

      <Section title="Notifications">
        <div className="divide-y divide-line -my-2">
          <Toggle checked={n.newExcellent} onChange={(v) => setN({ newExcellent: v })} label="New high-scoring jobs" description={`When a refresh finds a vacancy scoring ${n.excellentThreshold} or more.`} />
          {n.newExcellent && <div className="py-3"><Field label="Score threshold"><Input type="number" min={50} max={100} className="w-28" value={n.excellentThreshold} onChange={(e) => setN({ excellentThreshold: Math.max(50, Math.min(100, Number(e.target.value))) })} /></Field></div>}
          <Toggle checked={n.closingSoon} onChange={(v) => setN({ closingSoon: v })} label="Saved jobs closing soon" description="Three days before a published closing date." />
          <Toggle checked={n.savedUnavailable} onChange={(v) => setN({ savedUnavailable: v })} label="Saved jobs that close" description="When a saved or shortlisted vacancy disappears from the employer’s board." />
          <Toggle checked={n.followUps} onChange={(v) => setN({ followUps: v })} label="Follow-up reminders" description="The day before and on your follow-up date." />
          <Toggle checked={n.interviews} onChange={(v) => setN({ interviews: v })} label="Interview reminders" description="Two days before an interview." />
          <Toggle checked={n.statusChanges} onChange={(v) => setN({ statusChanges: v })} label="Status changes" description="A log entry each time you move an application." />
          <Toggle checked={n.previouslyAppliedCompanies} onChange={(v) => setN({ previouslyAppliedCompanies: v })} label="New roles at companies you’ve applied to" />
        </div>
        <p className="text-xs text-muted mt-3">Email delivery is optional — see “Email notifications” in DEPLOYMENT.md.</p>
      </Section>

      <Section title="Appearance">
        <div className="flex gap-2">
          {(['light', 'dark'] as const).map((t) => <Button key={t} variant={theme === t ? 'primary' : 'secondary'} onClick={() => set(t)}>{t === 'light' ? 'Light' : 'Dark'}</Button>)}
        </div>
      </Section>

      <Section title="Account">
        <p className="text-sm">Signed in as <b className="font-medium">{user?.email}</b></p>
        <div className="mt-4 flex flex-wrap gap-2">
          {isPasswordUser && <Button onClick={async () => { await resetPassword(user!.email!); toast('Password reset email sent'); }}><KeyRound className="size-4" />Send password reset email</Button>}
          <Button loading={busy} onClick={async () => { setBusy(true); try { const data = await exportAll(user!.uid); downloadBlob(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' }), `career-intel-export-${new Date().toISOString().slice(0, 10)}.json`); } finally { setBusy(false); } }}><Download className="size-4" />Export all my data</Button>
          <Button variant="ghost" onClick={logout}><LogOut className="size-4" />Sign out</Button>
        </div>
      </Section>
    </div>
  );
}
