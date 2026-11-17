import { useMemo, useState } from 'react';
import { ExternalLink, Globe, Bookmark, BookmarkCheck, Send, ThumbsDown, X, Quote, FileDown, AlertTriangle, CheckCircle2, Info } from 'lucide-react';
import clsx from 'clsx';
import { Badge, Button, Drawer, Field, IconButton, Input, Select, Tabs, Textarea } from '@/components/ui';
import { useUI } from '@/context/UIContext';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { APPLICATION_STATUSES, ATS_SOURCES, SOURCE_LABELS, type ApplicationStatus, type Job, type MatchAnalysis } from '@shared/types';
import { COUNTRY_NAMES } from '@shared/geo';
import { fmtDate, fmtSalary, relDays, safeUrl, downloadBlob } from '@/lib/format';
import { updateApplication, deleteApplication } from '@/lib/db';
import { coverLetterText } from '@/lib/letterText';
import { MatchBreakdown, MatchRibbon } from './MatchRibbon';
import { FreshnessBadge, SponsorshipBadge, StatusBadge, VerificationBadge } from './badges';
import { useJobActions } from './useJobActions';
import { locationLine } from './JobTable';

function hostPath(u: string) { try { const x = new URL(u); return x.host + x.pathname.slice(0, 40); } catch { return u.slice(0, 60); } }

type Tab = 'overview' | 'description' | 'match' | 'application' | 'documents';

export function JobDrawer() {
  const { openJobId, openJob, jobTab, setJobTab } = useUI();
  const { jobsById } = useData();
  const job = openJobId ? jobsById.get(openJobId) : undefined;
  if (!job) return null;
  return (
    <Drawer open onClose={() => openJob(null)} label={job.title}>
      <Header job={job} onClose={() => openJob(null)} />
      <div className="px-5"><Tabs<Tab> value={jobTab as Tab} onChange={setJobTab} items={[
        { id: 'overview', label: 'Overview' }, { id: 'description', label: 'Description' }, { id: 'match', label: 'Match analysis' },
        { id: 'application', label: 'Application' }, { id: 'documents', label: 'Documents' },
      ]} /></div>
      <div className="flex-1 overflow-y-auto px-5 py-5">
        {jobTab === 'overview' && <Overview job={job} />}
        {jobTab === 'description' && <Description job={job} />}
        {jobTab === 'match' && <MatchTab job={job} />}
        {jobTab === 'application' && <ApplicationTab job={job} />}
        {jobTab === 'documents' && <Documents job={job} />}
      </div>
    </Drawer>
  );
}

function Header({ job, onClose }: { job: Job; onClose: () => void }) {
  const a = useJobActions();
  const apply = safeUrl(job.applicationUrl);
  const site = safeUrl(job.companyWebsite);
  return (
    <div className="px-5 pt-4 pb-4 border-b border-line">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold leading-snug tracking-[-0.01em]">{job.title}</h2>
          <p className="text-sm text-muted mt-0.5">{job.company} — {locationLine(job)}</p>
        </div>
        <IconButton label="Close" onClick={onClose}><X className="size-4" /></IconButton>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <VerificationBadge status={job.verification.status} note={job.verification.note} />
        <SponsorshipBadge category={job.sponsorship.category} long />
        <FreshnessBadge job={job} />
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        {apply ? (
          <a href={apply} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-medium text-white dark:text-[#0f1115] hover:bg-accent/90"><ExternalLink className="size-4" />Apply on company site</a>
        ) : (
          <a href={safeUrl(job.sourceUrl) ?? '#'} target="_blank" rel="noopener noreferrer" title="No employer application link was found for this listing" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3.5 text-sm font-medium hover:bg-raised"><ExternalLink className="size-4" />Open {SOURCE_LABELS[job.primarySource]} listing</a>
        )}
        {site && <a href={site} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-line bg-surface px-3 text-sm hover:bg-raised"><Globe className="size-4" />Company</a>}
        <Button onClick={() => a.toggleSave(job)}>{job.status === 'Saved' ? <><BookmarkCheck className="size-4 text-accent" />Saved</> : <><Bookmark className="size-4" />Save</>}</Button>
        <Button onClick={() => a.markApplied(job)}><Send className="size-4" />Mark applied</Button>
        <Button variant="ghost" onClick={() => a.setStatus(job, 'Not Interested')}><ThumbsDown className="size-4" />Not interested</Button>
        <Select aria-label="Status" className="w-auto ml-auto h-9" value={job.status} onChange={(e) => a.setStatus(job, e.target.value as ApplicationStatus)}>
          {APPLICATION_STATUSES.map((s) => <option key={s}>{s}</option>)}
        </Select>
      </div>
      {!apply && <p className="mt-2 text-xs text-warn flex items-center gap-1.5"><AlertTriangle className="size-3.5" />Found on a job board only. Search the employer’s careers page and apply there if possible.</p>}
    </div>
  );
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return <div><dt className="text-xs text-muted">{label}</dt><dd className="text-sm mt-0.5">{children}</dd></div>;
}

function Overview({ job }: { job: Job }) {
  const { setJobTab } = useUI();
  return (
    <div className="space-y-6">
      {job.match && (
        <button onClick={() => setJobTab('match')} className="w-full text-left panel p-4 hover:bg-raised transition-colors">
          <MatchRibbon match={job.match} size="lg" />
          <p className="text-sm mt-3"><b className="font-medium">{(job.match.aiAnalysis ?? job.match.analysis).worthIt.verdict}:</b> <span className="text-muted">{(job.match.aiAnalysis ?? job.match.analysis).worthIt.reason}</span></p>
        </button>
      )}
      <dl className="grid grid-cols-2 sm:grid-cols-3 gap-x-4 gap-y-4">
        <Fact label="Posted">{job.postedAt ? <>{fmtDate(job.postedAt)} <span className="text-muted">({relDays(job.postedAt)})</span></> : <span className="text-muted">Not provided by source</span>}</Fact>
        <Fact label="Closing date">{job.closingDate ? fmtDate(job.closingDate) : <span className="text-muted">Not stated</span>}</Fact>
        <Fact label="Salary">{job.salary ? fmtSalary(job.salary) : <span className="text-muted">Not published</span>}</Fact>
        <Fact label="Employment type">{job.employmentType ?? <span className="text-muted">Not stated</span>}</Fact>
        <Fact label="Work arrangement">{job.workArrangement === 'Unknown' ? <span className="text-muted">Not stated</span> : job.workArrangement}</Fact>
        <Fact label="Country">{job.country ? COUNTRY_NAMES[job.country] ?? job.country : <span className="text-muted">Unspecified</span>}</Fact>
        <Fact label="Experience asked">{job.experienceRequired ?? <span className="text-muted">Not stated</span>}</Fact>
        <Fact label="First seen">{fmtDate(job.firstSeenAt)}</Fact>
        <Fact label="Last verified">{job.lastVerifiedAt ? fmtDate(job.lastVerifiedAt, true) : <span className="text-muted">Never confirmed</span>}</Fact>
      </dl>
      {job.educationRequired && <Fact label="Education">{job.educationRequired}</Fact>}

      <div className="panel p-4">
        <div className="flex items-center justify-between gap-3"><h3 className="h-section">Visa sponsorship</h3><SponsorshipBadge category={job.sponsorship.category} long /></div>
        <p className="text-sm text-muted mt-2">{(job.match?.aiAnalysis ?? job.match?.analysis)?.sponsorship ?? 'Classified from the posting text.'}</p>
        {job.sponsorship.evidence && (
          <blockquote className="mt-3 flex gap-2 text-sm border-l-2 border-line pl-3 text-ink/80"><Quote className="size-3.5 shrink-0 mt-1 text-faint" />{job.sponsorship.evidence}</blockquote>
        )}
      </div>

      <div>
        <h3 className="h-section mb-2">Vacancy check</h3>
        <p className="text-sm"><VerificationBadge status={job.verification.status} note={job.verification.note} /> <span className="text-muted ml-1">{job.verification.method}{job.verification.note ? `. ${job.verification.note}.` : '.'} Checked {fmtDate(job.verification.checkedAt, true)}.</span></p>
        <ul className="mt-3 space-y-1.5">
          {job.sources.map((s) => (
            <li key={s.source + s.externalId} className="text-sm flex items-center gap-2">
              <Badge tone={ATS_SOURCES.includes(s.source) ? 'good' : 'neutral'}>{SOURCE_LABELS[s.source]}</Badge>
              <a href={safeUrl(s.sourceUrl) ?? '#'} target="_blank" rel="noopener noreferrer" className="link truncate">{hostPath(s.sourceUrl)}</a>
              <span className="text-xs text-faint ml-auto whitespace-nowrap">seen {relDays(s.lastSeenAt)}</span>
            </li>
          ))}
        </ul>
        {job.applicationUrl && <p className="text-xs text-muted mt-2">Employer application page: <a className="link break-all" href={safeUrl(job.applicationUrl) ?? '#'} target="_blank" rel="noopener noreferrer">{job.applicationUrl}</a></p>}
      </div>
    </div>
  );
}

function Description({ job }: { job: Job }) {
  return (
    <div>
      {job.requiredSkills.length > 0 && (
        <div className="mb-5">
          <h3 className="text-xs text-muted mb-2">Skills named in the posting</h3>
          <div className="flex flex-wrap gap-1.5">
            {job.requiredSkills.map((s) => <Badge key={s} tone={job.match?.matchedSkills.includes(s) ? 'good' : 'neutral'}>{job.match?.matchedSkills.includes(s) && <CheckCircle2 className="size-3" />}{s}</Badge>)}
          </div>
        </div>
      )}
      <div className="prose-job">{job.description || 'The source did not provide a description. Open the listing to read it.'}</div>
    </div>
  );
}

function AnalysisBlock({ a }: { a: MatchAnalysis }) {
  const List = ({ items, tone }: { items: string[]; tone?: 'good' | 'bad' }) => items.length ? (
    <ul className="space-y-1.5">{items.map((x, i) => <li key={i} className="text-sm flex gap-2"><span className={clsx('mt-[0.55rem] size-1.5 rounded-full shrink-0', tone === 'good' ? 'bg-good' : tone === 'bad' ? 'bg-bad' : 'bg-faint')} />{x}</li>)}</ul>
  ) : <p className="text-sm text-muted">None.</p>;
  const block = (t: string, c: React.ReactNode) => <div><h4 className="text-[0.8125rem] font-semibold mb-2">{t}</h4>{c}</div>;
  return (
    <div className="space-y-6">
      {block('Why you’re a suitable candidate', <p className="text-sm leading-relaxed">{a.suitability}</p>)}
      {block('Where your resume matches', <List items={a.matches} tone="good" />)}
      {block('Skills you’re missing', a.missingSkills.length ? <div className="flex flex-wrap gap-1.5">{a.missingSkills.map((s) => <Badge key={s} tone="warn">{s}</Badge>)}</div> : <p className="text-sm text-muted">None detected.</p>)}
      {block('Experience gaps', <List items={a.experienceGaps} />)}
      {block('Potential rejection factors', <List items={a.rejectionRisks} tone="bad" />)}
      {block('Sponsorship feasibility', <p className="text-sm">{a.sponsorship}</p>)}
      {block('Is it worth your time?', <p className="text-sm"><Badge tone={a.worthIt.verdict === 'Apply' ? 'good' : a.worthIt.verdict === 'Consider' ? 'warn' : 'bad'}>{a.worthIt.verdict}</Badge> <span className="ml-1">{a.worthIt.reason}</span></p>)}
      {block('Three ways to strengthen this application', <ol className="space-y-2 list-decimal pl-5 text-sm marker:text-muted">{a.recommendations.map((r, i) => <li key={i}>{r}</li>)}</ol>)}
    </div>
  );
}

function MatchTab({ job }: { job: Job }) {
  const { resumes } = useData();
  const [useAi, setUseAi] = useState(true);
  const m = job.match;
  if (!m) return <p className="text-sm text-muted">Upload a resume in Resume Intelligence to score this vacancy.</p>;
  const ai = m.aiAnalysis;
  const best = resumes.find((r) => r.id === m.resumeVersionId);
  return (
    <div className="space-y-8">
      <div>
        <MatchRibbon match={m} size="lg" />
        <p className="text-sm text-muted mt-2">{m.label} match. Scored against <b className="text-ink font-medium">{best?.name ?? 'your resume'}</b>{Object.keys(m.perVersion).length > 1 && ' — the best of your resume versions'}.</p>
        {Object.keys(m.perVersion).length > 1 && (
          <div className="mt-2 flex flex-wrap gap-1.5">{Object.entries(m.perVersion).sort((a, b) => b[1] - a[1]).map(([id, s]) => <Badge key={id} tone={id === m.resumeVersionId ? 'accent' : 'neutral'}>{resumes.find((r) => r.id === id)?.name ?? 'Deleted version'}: {s}</Badge>)}</div>
        )}
      </div>
      <MatchBreakdown match={m} />
      <div className="border-t border-line pt-6">
        {ai && (
          <div className="mb-5 flex items-center gap-2 text-sm">
            <Tabs value={useAi ? 'ai' : 'rules'} onChange={(v) => setUseAi(v === 'ai')} items={[{ id: 'ai', label: 'AI analysis' }, { id: 'rules', label: 'Rules analysis' }]} />
          </div>
        )}
        <AnalysisBlock a={ai && useAi ? ai : m.analysis} />
        <p className="mt-6 text-xs text-faint flex gap-1.5"><Info className="size-3.5 shrink-0" />{ai && useAi ? `Written by ${ai.model} on ${fmtDate(ai.generatedAt)} from your resume and this posting. The score itself comes from the transparent rules engine.` : 'Generated by the rules engine from text found in your resume and this posting. Nothing is inferred beyond that text.'}</p>
      </div>
    </div>
  );
}

function ApplicationTab({ job }: { job: Job }) {
  const { appsByJob, resumes } = useData();
  const { user } = useAuth();
  const { toast, openApply } = useUI();
  const app = appsByJob.get(job.id);
  const [draft, setDraft] = useState(() => app ? { notes: app.notes, referral: app.referral, nextFollowUp: app.nextFollowUp ?? '', interviewDate: app.interviewDate ?? '', appliedDate: app.appliedDate, resumeVersionId: app.resumeVersionId ?? '' } : null);
  const [saving, setSaving] = useState(false);
  if (!app || !draft) {
    return (
      <div className="text-center py-10">
        <p className="text-sm font-medium">No application recorded</p>
        <p className="text-sm text-muted mt-1">Apply on the employer’s site, then record it here to track follow-ups and interviews.</p>
        <Button variant="primary" className="mt-4" onClick={() => openApply(job.id)}><Send className="size-4" />Mark as applied</Button>
      </div>
    );
  }
  const save = async () => {
    setSaving(true);
    try {
      const r = resumes.find((x) => x.id === draft.resumeVersionId);
      await updateApplication(user!.uid, job.id, { ...draft, nextFollowUp: draft.nextFollowUp || null, interviewDate: draft.interviewDate || null, resumeVersionId: r?.id ?? null, resumeVersionName: r?.name ?? null });
      toast('Application updated');
    } catch (e) { toast((e as Error).message, 'error'); } finally { setSaving(false); }
  };
  return (
    <div className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field label="Applied on"><Input type="date" value={draft.appliedDate} onChange={(e) => setDraft({ ...draft, appliedDate: e.target.value })} /></Field>
        <Field label="Next follow-up"><Input type="date" value={draft.nextFollowUp} onChange={(e) => setDraft({ ...draft, nextFollowUp: e.target.value })} /></Field>
        <Field label="Interview date"><Input type="date" value={draft.interviewDate} onChange={(e) => setDraft({ ...draft, interviewDate: e.target.value })} /></Field>
        <Field label="Resume version used">
          <Select value={draft.resumeVersionId} onChange={(e) => setDraft({ ...draft, resumeVersionId: e.target.value })}>
            <option value="">{app.resumeVersionName && !resumes.some((r) => r.id === app.resumeVersionId) ? `${app.resumeVersionName} (deleted)` : 'Not recorded'}</option>
            {resumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </Select>
        </Field>
        <Field label="Referral" className="sm:col-span-2"><Input value={draft.referral} onChange={(e) => setDraft({ ...draft, referral: e.target.value })} /></Field>
        <Field label="Notes" className="sm:col-span-2"><Textarea rows={5} value={draft.notes} onChange={(e) => setDraft({ ...draft, notes: e.target.value })} /></Field>
      </div>
      <div className="flex gap-2">
        <Button variant="primary" loading={saving} onClick={save}>Save changes</Button>
        <Button variant="ghost" onClick={async () => { if (confirm('Remove this application record? The job moves back to Saved.')) { await deleteApplication(user!.uid, job); toast('Application record removed'); } }}>Remove record</Button>
      </div>
      <p className="text-xs text-muted">Applied via <a className="link break-all" href={safeUrl(app.applicationUrl) ?? '#'} target="_blank" rel="noopener noreferrer">{app.applicationUrl}</a></p>
      <div>
        <h3 className="h-section mb-3">History</h3>
        <ol className="relative border-l border-line ml-1.5 space-y-4">
          {[...app.history].reverse().map((h, i) => (
            <li key={i} className="pl-4 relative">
              <span className="absolute -left-[5px] top-1.5 size-2.5 rounded-full bg-surface border-2 border-accent" />
              <div className="flex items-center gap-2"><StatusBadge status={h.status} /><span className="text-xs text-muted">{fmtDate(h.at, true)}</span></div>
              {h.note && <p className="text-sm text-muted mt-1">{h.note}</p>}
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}

function Documents({ job }: { job: Job }) {
  const { resumes } = useData();
  const [rid, setRid] = useState(job.match?.resumeVersionId ?? resumes.find((r) => r.isPrimary)?.id ?? resumes[0]?.id ?? '');
  const resume = resumes.find((r) => r.id === rid);
  const preview = useMemo(() => (resume ? coverLetterText(job, resume) : []), [job, resume]);
  if (!resumes.length) return <p className="text-sm text-muted">Upload a resume first.</p>;
  const slug = `${job.company}-${job.title}`.replace(/[^a-z0-9]+/gi, '-').slice(0, 60);
  return (
    <div className="space-y-5">
      <p className="text-sm text-muted">Built only from facts on your resume and in the posting. Bracketed prompts mark where you add your own specifics — nothing is invented, and nothing is ever submitted for you.</p>
      <Field label="Resume version"><Select value={rid} onChange={(e) => setRid(e.target.value)}>{resumes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</Select></Field>
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" disabled={!resume} onClick={async () => { const g = await import('@/lib/generate'); downloadBlob(await g.coverLetterDocx(job, resume!), `Cover-letter-${slug}.docx`); }}><FileDown className="size-4" />Cover letter (.docx)</Button>
        <Button disabled={!resume} onClick={async () => { const g = await import('@/lib/generate'); downloadBlob(await g.tailoredResumeDocx(job, resume!), `Resume-${slug}.docx`); }}><FileDown className="size-4" />Tailored resume (.docx)</Button>
      </div>
      <div className="panel p-4 bg-raised">
        <h3 className="text-xs text-muted mb-3">Cover letter preview</h3>
        <div className="space-y-3 text-sm leading-relaxed max-w-[68ch]">{preview.map((t, i) => <p key={i} className="whitespace-pre-line">{t}</p>)}</div>
      </div>
    </div>
  );
}
