import { useEffect, useMemo, useRef, useState } from 'react';
import clsx from 'clsx';
import { Upload, FileText, Star, Trash2, Download, Plus, X, RefreshCw, Sparkles, Pencil, Check } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { PageHeader, Section, Button, Badge, Input, Field, Select, Empty } from '@/components/ui';
import { extractText, fileToBase64 } from '@/lib/resumeExtract';
import { deleteResume, getResumeFile, renameResume, rescoreJobs, saveResume, savePreferences, setPrimaryResume, updateResumeProfile } from '@/lib/db';
import { parseResumeText } from '@shared/resumeParser';
import { SKILLS } from '@shared/skills';
import type { ResumeProfile, ResumeVersion } from '@shared/types';
import { fmtDate, downloadBlob } from '@/lib/format';

export function Resume() {
  const { resumes, primaryResume, jobs, prefs } = useData();
  const { user } = useAuth();
  const { toast } = useUI();
  const uid = user!.uid;
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = resumes.find((r) => r.id === selectedId) ?? primaryResume;
  const [progress, setProgress] = useState<string | null>(null);

  const rescore = async (versions: ResumeVersion[]) => {
    if (!jobs.length) return;
    setProgress('Re-scoring vacancies…');
    await rescoreJobs(uid, jobs, versions, prefs.requiresSponsorship, (d, t) => setProgress(`Re-scoring vacancies… ${d}/${t}`));
    setProgress(null);
  };

  return (
    <div className="space-y-6">
      <PageHeader title="Resume intelligence" description="Your resume is read in the browser and stored only in your private Firestore. Every match score is computed from what it actually says."
        actions={resumes.length > 0 && jobs.length > 0 && <Button onClick={() => rescore(resumes).then(() => toast('All vacancies re-scored'))} loading={!!progress}><RefreshCw className="size-4" />Re-score all vacancies</Button>} />
      {progress && <p className="text-sm text-muted -mt-3">{progress}</p>}

      <div className="grid xl:grid-cols-[1fr_22rem] gap-6 items-start">
        <div className="space-y-6 min-w-0">
          {selected ? <ProfileView key={selected.id + selected.updatedAt} resume={selected} onSaved={(profile) => rescore(resumes.map((r) => (r.id === selected.id ? { ...r, profile } : r)))} /> : (
            <div className="panel"><Empty icon={<FileText className="size-6" />} title="Upload your resume to begin">PDF or DOCX. Skills, experience, education and certifications are extracted automatically — and you can correct anything the parser misreads.</Empty></div>
          )}
        </div>
        <div className="space-y-6">
          <Uploader resumes={resumes} onUploaded={async (v) => { setSelectedId(v.id); toast(`Saved “${v.name}”`); await rescore([...resumes.filter((r) => r.id !== v.id), v]); }} />
          {resumes.length > 0 && (
            <Section title="Versions" bodyClass="">
              <ul className="divide-y divide-line">
                {resumes.map((r) => <VersionRow key={r.id} r={r} active={r.id === selected?.id} onSelect={() => setSelectedId(r.id)} all={resumes} />)}
              </ul>
            </Section>
          )}
        </div>
      </div>
    </div>
  );
}

function Uploader({ resumes, onUploaded }: { resumes: ResumeVersion[]; onUploaded: (v: ResumeVersion) => void }) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [name, setName] = useState('');
  const [replaceId, setReplaceId] = useState('');
  const [primary, setPrimary] = useState(true);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [drag, setDrag] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  const pick = (f: File | undefined) => {
    if (!f) return;
    setErr(null);
    if (!/\.(pdf|docx)$/i.test(f.name)) { setErr('Upload a PDF or DOCX file.'); return; }
    if (f.size > 8 * 1024 * 1024) { setErr('File is larger than 8 MB.'); return; }
    setFile(f);
    setName(f.name.replace(/\.(pdf|docx)$/i, '').replace(/[_-]+/g, ' ').slice(0, 60));
  };
  const submit = async () => {
    if (!file) return;
    setBusy(true); setErr(null);
    try {
      const { text, type } = await extractText(file);
      const profile = parseResumeText(text);
      const base64 = file.size <= 700 * 1024 ? await fileToBase64(file) : null;
      const v = await saveResume(user!.uid, { name, file, text, type, profile, base64, makePrimary: primary, replaceId: replaceId || undefined });
      setFile(null); setReplaceId('');
      onUploaded(v);
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <Section title={resumes.length ? 'Upload a version' : 'Upload resume'}>
      <div
        onDragOver={(e) => { e.preventDefault(); setDrag(true); }} onDragLeave={() => setDrag(false)}
        onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files[0]); }}
        className={clsx('rounded-xl border border-dashed px-4 py-7 text-center transition-colors', drag ? 'border-accent bg-accent-soft/50' : 'border-line')}>
        <Upload className="size-5 mx-auto text-muted" />
        <p className="text-sm mt-2">{file ? <b className="font-medium">{file.name}</b> : 'Drop a PDF or DOCX here'}</p>
        <button className="text-sm link mt-1" onClick={() => input.current?.click()}>{file ? 'Choose a different file' : 'or browse files'}</button>
        <input ref={input} type="file" accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} />
      </div>
      {file && (
        <div className="mt-4 space-y-3 anim-fade">
          <Field label="Version name" hint="e.g. “BI focus”, “Operations focus”"><Input value={name} onChange={(e) => setName(e.target.value)} maxLength={80} /></Field>
          {resumes.length > 0 && (
            <Field label="Save as">
              <Select value={replaceId} onChange={(e) => setReplaceId(e.target.value)}>
                <option value="">New version</option>
                {resumes.map((r) => <option key={r.id} value={r.id}>Replace “{r.name}”</option>)}
              </Select>
            </Field>
          )}
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" className="accent-[rgb(var(--accent))]" checked={primary} onChange={(e) => setPrimary(e.target.checked)} />Make this my primary resume</label>
          <Button variant="primary" className="w-full" loading={busy} onClick={submit} disabled={!name.trim()}>Read and save resume</Button>
        </div>
      )}
      {err && <p role="alert" className="text-sm text-bad mt-3">{err}</p>}
      <p className="text-xs text-muted mt-3">Files up to 700 KB are kept so you can re-download them. Larger files keep only their extracted text.</p>
    </Section>
  );
}

function VersionRow({ r, active, onSelect, all }: { r: ResumeVersion; active: boolean; onSelect: () => void; all: ResumeVersion[] }) {
  const { user } = useAuth();
  const { toast } = useUI();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(r.name);
  return (
    <li className={clsx('px-4 py-3', active && 'bg-raised')}>
      <div className="flex items-start gap-2">
        <button className="min-w-0 flex-1 text-left" onClick={onSelect}>
          {editing ? (
            <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
              <Input className="h-7" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
              <button aria-label="Save name" className="size-7 inline-flex items-center justify-center text-good" onClick={async () => { await renameResume(user!.uid, r.id, name); setEditing(false); }}><Check className="size-4" /></button>
            </span>
          ) : (
            <span className="flex items-center gap-1.5 text-sm font-medium">{r.name}{r.isPrimary && <Badge tone="accent"><Star className="size-3" />Primary</Badge>}</span>
          )}
          <span className="block text-xs text-muted mt-0.5 truncate">{r.fileName} — {r.fileType.toUpperCase()}, {Math.round(r.fileSize / 1024)} KB — {fmtDate(r.updatedAt)}</span>
        </button>
      </div>
      <div className="mt-2 flex flex-wrap gap-1">
        {!r.isPrimary && <Button size="sm" variant="ghost" onClick={() => setPrimaryResume(user!.uid, r.id, all).then(() => toast('Primary resume updated'))}><Star className="size-3.5" />Make primary</Button>}
        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}><Pencil className="size-3.5" />Rename</Button>
        {r.hasStoredFile && <Button size="sm" variant="ghost" onClick={async () => {
          const f = await getResumeFile(user!.uid, r.id);
          if (!f) return toast('Original file not found', 'error');
          const bytes = Uint8Array.from(atob(f.data), (c) => c.charCodeAt(0));
          downloadBlob(new Blob([bytes], { type: f.mime }), f.name);
        }}><Download className="size-3.5" />Download</Button>}
        <Button size="sm" variant="ghost" className="text-bad hover:text-bad" onClick={() => { if (confirm(`Delete “${r.name}”? Applications that used it keep its name.`)) deleteResume(user!.uid, r, all).then(() => toast('Version deleted')); }}><Trash2 className="size-3.5" />Delete</Button>
      </div>
    </li>
  );
}

function ProfileView({ resume, onSaved }: { resume: ResumeVersion; onSaved: (p: ResumeProfile) => void }) {
  const { user } = useAuth();
  const { prefs } = useData();
  const { toast } = useUI();
  const [p, setP] = useState<ResumeProfile>(resume.profile);
  const [dirty, setDirty] = useState(false);
  const [newSkill, setNewSkill] = useState('');
  const [saving, setSaving] = useState(false);
  useEffect(() => { setP(resume.profile); setDirty(false); }, [resume]);
  const upd = (patch: Partial<ResumeProfile>) => { setP({ ...p, ...patch }); setDirty(true); };
  const skillOptions = useMemo(() => SKILLS.map((s) => s.name).filter((s) => !p.skills.includes(s)), [p.skills]);
  const save = async () => {
    setSaving(true);
    try { await updateResumeProfile(user!.uid, resume.id, p); setDirty(false); toast('Profile saved'); onSaved(p); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setSaving(false); }
  };
  const addTitle = async (t: string) => {
    if (prefs.targetTitles.includes(t)) return;
    await savePreferences(user!.uid, { ...prefs, targetTitles: [...prefs.targetTitles, t] });
    toast(`Added “${t}” to target titles`);
  };
  const titles = [...new Set([...(resume.aiProfile?.suggestedTitles ?? []), ...p.suggestedTitles])];

  return (
    <>
      <Section title="Professional profile" action={resume.aiProfile && <span className="text-xs text-muted inline-flex items-center gap-1"><Sparkles className="size-3.5" />{resume.aiProfile.model}</span>}>
        {resume.aiProfile ? (
          <div className="space-y-4">
            <p className="text-sm leading-relaxed max-w-[72ch]">{resume.aiProfile.summary}</p>
            {resume.aiProfile.strengths.length > 0 && <ul className="space-y-1">{resume.aiProfile.strengths.map((s, i) => <li key={i} className="text-sm flex gap-2"><span className="mt-2 size-1.5 rounded-full bg-good shrink-0" />{s}</li>)}</ul>}
            {resume.aiProfile.textHash !== resume.textHash && <p className="text-xs text-warn">Written for an earlier upload of this version — it refreshes on the next scheduled run.</p>}
          </div>
        ) : (
          <div className="text-sm text-muted space-y-2 max-w-[68ch]">
            <p><b className="text-ink font-medium">{p.name ?? 'Name not detected'}</b>{p.headline ? ` — ${p.headline}` : ''}</p>
            <p>{p.totalYears != null ? `About ${p.totalYears} years of experience` : 'Experience length not detected'}{p.skills.length ? `, with ${p.skills.slice(0, 6).join(', ')}${p.skills.length > 6 ? ` and ${p.skills.length - 6} more skills` : ''}` : ''}.</p>
            <p className="text-xs">An AI-written profile appears here after the next refresh if an LLM key is configured (LLM_API_KEY secret — see DEPLOYMENT.md). Matching works without it.</p>
          </div>
        )}
      </Section>

      <Section title="Extracted information" action={dirty && <Button size="sm" variant="primary" loading={saving} onClick={save}>Save corrections</Button>}>
        <p className="text-xs text-muted mb-4 max-w-[72ch]">Correct anything the parser misread. Only change what’s true on your resume — these fields drive every match score.</p>
        <div className="grid sm:grid-cols-3 gap-4">
          <Field label="Name"><Input value={p.name ?? ''} onChange={(e) => upd({ name: e.target.value || null })} /></Field>
          <Field label="Email"><Input value={p.email ?? ''} onChange={(e) => upd({ email: e.target.value || null })} /></Field>
          <Field label="Total experience (years)" hint="Calculated from employment dates."><Input type="number" min={0} max={50} step={0.1} value={p.totalYears ?? ''} onChange={(e) => upd({ totalYears: e.target.value === '' ? null : Number(e.target.value) })} /></Field>
        </div>

        <h3 className="text-[0.8125rem] font-semibold mt-6 mb-2">Skills ({p.skills.length})</h3>
        <div className="flex flex-wrap gap-1.5">
          {p.skills.map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-md bg-raised border border-line pl-2 pr-1 h-7 text-[0.8125rem]">
              {s}<button aria-label={`Remove ${s}`} className="size-5 inline-flex items-center justify-center rounded text-faint hover:text-bad" onClick={() => upd({ skills: p.skills.filter((x) => x !== s) })}><X className="size-3" /></button>
            </span>
          ))}
        </div>
        <div className="mt-3 flex gap-2 max-w-md">
          <Input list="skill-options" placeholder="Add a skill that’s on your resume" value={newSkill} onChange={(e) => setNewSkill(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && newSkill.trim()) { upd({ skills: [...p.skills, newSkill.trim()] }); setNewSkill(''); } }} />
          <datalist id="skill-options">{skillOptions.map((s) => <option key={s} value={s} />)}</datalist>
          <Button onClick={() => { if (newSkill.trim()) { upd({ skills: [...p.skills, newSkill.trim()] }); setNewSkill(''); } }}><Plus className="size-4" />Add</Button>
        </div>

        <h3 className="text-[0.8125rem] font-semibold mt-6 mb-2">Experience</h3>
        {p.experience.length ? (
          <ol className="space-y-2">
            {p.experience.map((x, i) => (
              <li key={i} className="grid sm:grid-cols-[1fr_1fr_auto] gap-2 items-center">
                <Input value={x.title} aria-label="Job title" onChange={(e) => upd({ experience: p.experience.map((y, k) => k === i ? { ...y, title: e.target.value } : y) })} />
                <Input value={x.company} aria-label="Company" onChange={(e) => upd({ experience: p.experience.map((y, k) => k === i ? { ...y, company: e.target.value } : y) })} />
                <span className="text-xs text-muted whitespace-nowrap num">{x.start ?? '?'} → {x.end ?? 'present'}</span>
              </li>
            ))}
          </ol>
        ) : <p className="text-sm text-muted">No dated roles detected. Use month–year ranges (e.g. “May 2023 – Present”) on your resume for accurate experience scoring.</p>}

        <div className="grid sm:grid-cols-2 gap-6 mt-6">
          <div>
            <h3 className="text-[0.8125rem] font-semibold mb-2">Education</h3>
            {p.education.length ? <ul className="space-y-2">{p.education.map((e, i) => <li key={i} className="text-sm"><div>{e.degree}</div>{e.institution && e.institution !== e.degree && <div className="text-xs text-muted">{e.institution}{e.period ? `, ${e.period}` : ''}</div>}</li>)}</ul> : <p className="text-sm text-muted">None detected.</p>}
          </div>
          <div>
            <h3 className="text-[0.8125rem] font-semibold mb-2">Certifications</h3>
            {p.certifications.length ? <ul className="space-y-1">{p.certifications.map((c, i) => <li key={i} className="text-sm">{c}</li>)}</ul> : <p className="text-sm text-muted">None detected.</p>}
          </div>
        </div>
        {p.achievements.length > 0 && (
          <div className="mt-6">
            <h3 className="text-[0.8125rem] font-semibold mb-2">Quantified achievements</h3>
            <ul className="space-y-1.5">{p.achievements.map((a, i) => <li key={i} className="text-sm flex gap-2"><span className="mt-2 size-1.5 rounded-full bg-faint shrink-0" />{a}</li>)}</ul>
          </div>
        )}
      </Section>

      <Section title="Job titles your resume supports">
        <p className="text-xs text-muted mb-3">Derived from your skills{resume.aiProfile ? ' and the AI profile' : ''}. Add any to your search.</p>
        <div className="flex flex-wrap gap-2">
          {titles.map((t) => {
            const has = prefs.targetTitles.includes(t);
            return <button key={t} disabled={has} onClick={() => addTitle(t)} className={clsx('inline-flex items-center gap-1 h-8 px-3 rounded-lg border text-sm', has ? 'border-line text-muted' : 'border-accent/30 text-accent hover:bg-accent-soft')}>{has ? <Check className="size-3.5" /> : <Plus className="size-3.5" />}{t}</button>;
          })}
          {!titles.length && <p className="text-sm text-muted">Add skills above to see suggestions.</p>}
        </div>
      </Section>

      <details className="panel">
        <summary className="px-4 h-12 flex items-center cursor-pointer h-section">Extracted text</summary>
        <pre className="px-4 pb-4 text-xs text-muted whitespace-pre-wrap font-sans leading-relaxed max-h-96 overflow-y-auto">{resume.text}</pre>
      </details>
    </>
  );
}
