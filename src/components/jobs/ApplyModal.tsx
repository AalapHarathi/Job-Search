import { useEffect, useMemo, useState } from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button, Field, Input, Modal, Select, Textarea } from '@/components/ui';
import { useData } from '@/context/DataContext';
import { useUI } from '@/context/UIContext';
import { useAuth } from '@/context/AuthContext';
import { DuplicateApplicationError, markApplied, type ApplyForm } from '@/lib/db';
import { todayIso } from '@/lib/format';
import { normCompany, normTitle } from '@shared/dedupe';

export function ApplyModal() {
  const { applyJobId, openApply, toast } = useUI();
  const { jobsById, resumes, applications } = useData();
  const { user } = useAuth();
  const job = applyJobId ? jobsById.get(applyJobId) : undefined;
  const [form, setForm] = useState<ApplyForm | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!job) { setForm(null); return; }
    const best = resumes.find((r) => r.id === job.match?.resumeVersionId) ?? resumes.find((r) => r.isPrimary) ?? null;
    const fu = new Date(); fu.setDate(fu.getDate() + 7);
    setForm({
      appliedDate: todayIso(), company: job.company, title: job.title, applicationUrl: job.applicationUrl ?? job.sourceUrl,
      resumeVersionId: best?.id ?? null, resumeVersionName: best?.name ?? null, notes: '', referral: '', nextFollowUp: fu.toISOString().slice(0, 10),
    });
    setError(null);
  }, [job, resumes]);

  const similar = useMemo(() => job ? applications.find((a) => a.jobId !== job.id && normCompany(a.company) === normCompany(job.company) && normTitle(a.title) === normTitle(job.title)) : undefined, [applications, job]);

  if (!job || !form) return null;
  const set = <K extends keyof ApplyForm>(k: K, v: ApplyForm[K]) => setForm({ ...form, [k]: v });
  const submit = async () => {
    setSaving(true); setError(null);
    try {
      await markApplied(user!.uid, job, form);
      toast(`Marked as applied: ${job.title}`);
      openApply(null);
    } catch (e) {
      setError(e instanceof DuplicateApplicationError ? e.message : (e as Error).message);
    } finally { setSaving(false); }
  };

  return (
    <Modal open onClose={() => openApply(null)} title="Mark as applied" width="max-w-xl"
      footer={<><Button variant="ghost" onClick={() => openApply(null)}>Cancel</Button><Button variant="primary" loading={saving} onClick={submit}>Mark as applied</Button></>}>
      {similar && (
        <div className="mb-4 flex gap-2 rounded-lg border border-warn/30 bg-warn/5 p-3 text-sm">
          <AlertTriangle className="size-4 text-warn shrink-0 mt-0.5" />
          <span>You recorded an application for <b>{similar.title}</b> at {similar.company} on {similar.appliedDate}. Check this isn’t the same vacancy before continuing.</span>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Application date"><Input type="date" value={form.appliedDate} max={todayIso()} onChange={(e) => set('appliedDate', e.target.value)} /></Field>
        <Field label="Next follow-up"><Input type="date" value={form.nextFollowUp} onChange={(e) => set('nextFollowUp', e.target.value)} /></Field>
        <Field label="Company"><Input value={form.company} onChange={(e) => set('company', e.target.value)} /></Field>
        <Field label="Job title"><Input value={form.title} onChange={(e) => set('title', e.target.value)} /></Field>
        <Field label="Application URL" className="sm:col-span-2" hint={job.applicationUrl ? 'Employer application page' : 'No employer link was found — replace with the page you actually applied on.'}>
          <Input type="url" value={form.applicationUrl} onChange={(e) => set('applicationUrl', e.target.value)} />
        </Field>
        <Field label="Resume version used" className="sm:col-span-2">
          <Select value={form.resumeVersionId ?? ''} onChange={(e) => { const r = resumes.find((x) => x.id === e.target.value); setForm({ ...form, resumeVersionId: r?.id ?? null, resumeVersionName: r?.name ?? null }); }}>
            <option value="">Not recorded</option>
            {resumes.map((r) => <option key={r.id} value={r.id}>{r.name}{job.match?.perVersion?.[r.id] != null ? ` — ${job.match.perVersion[r.id]}% match` : ''}</option>)}
          </Select>
        </Field>
        <Field label="Referral" className="sm:col-span-2" hint="Who referred you, if anyone."><Input value={form.referral} onChange={(e) => set('referral', e.target.value)} placeholder="e.g. Priya (ex-colleague, Data team)" /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Cover letter angle, questions asked in the form, salary expectation given…" /></Field>
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-bad">{error}</p>}
    </Modal>
  );
}
