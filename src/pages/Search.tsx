import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import clsx from 'clsx';
import { AlertTriangle, Bookmark, BookmarkCheck, Building2, CheckCircle2, ExternalLink, MapPin, RefreshCw, Search as SearchIcon, Send, ShieldCheck } from 'lucide-react';
import { Badge, Button, Empty, PageHeader, Select, Spinner, Toggle } from '@/components/ui';
import { SponsorshipBadge, StatusBadge } from '@/components/jobs/badges';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { setJobStatus } from '@/lib/db';
import { checkStillOpen, importIndexJob, ListingClosedError } from '@/lib/importJob';
import { fmtDateTimeRel, relDays, safeUrl } from '@/lib/format';
import { filterIndex, skillOverlap, type IndexJob, type SearchIndex, type SearchQuery } from '@shared/searchIndex';
import { COUNTRY_NAMES } from '@shared/geo';
import { SOURCE_LABELS, type ApplicationStatus, type AtsSource, type WorkArrangement } from '@shared/types';

let cached: Promise<SearchIndex> | null = null;
function loadIndex(force = false): Promise<SearchIndex> {
  if (!cached || force) {
    cached = fetch(`${import.meta.env.BASE_URL}data/jobs-index.json`, { cache: force ? 'reload' : 'default' }).then(async (r) => {
      if (r.status === 404) throw new Error('NOT_BUILT');
      if (!r.ok) throw new Error(`Couldn’t load the job index (HTTP ${r.status}).`);
      return (await r.json()) as SearchIndex;
    });
    cached.catch(() => { cached = null; });
  }
  return cached;
}

type SortKey = 'relevance' | 'newest' | 'skills';
const PAGE = 40;

export function Search() {
  const [params, setParams] = useSearchParams();
  const { prefs, primaryResume, resumes, jobsById } = useData();
  const [index, setIndex] = useState<SearchIndex | null>(null);
  const [loadErr, setLoadErr] = useState<string | null>(null);
  const [draft, setDraft] = useState(params.get('q') ?? '');
  const [text, setText] = useState(params.get('q') ?? '');
  const [searched, setSearched] = useState(!!params.get('q'));
  const enabledCountries = useMemo(() => prefs.countries.filter((c) => c.enabled).map((c) => c.code), [prefs.countries]);
  const [countries, setCountries] = useState<string[]>(enabledCountries);
  const [includeRemote, setIncludeRemote] = useState(true);
  const [arrangement, setArrangement] = useState<WorkArrangement | 'Any'>('Any');
  const [posted, setPosted] = useState<number | null>(30);
  const [hideNoSponsor, setHideNoSponsor] = useState(prefs.requiresSponsorship);
  const [source, setSource] = useState<AtsSource | 'Any'>('Any');
  const [sort, setSort] = useState<SortKey>('relevance');
  const [shown, setShown] = useState(PAGE);
  const [showSources, setShowSources] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { loadIndex().then(setIndex, (e: Error) => setLoadErr(e.message)); }, []);
  useEffect(() => { const q = params.get('q'); if (q !== null && q !== text) { setDraft(q); setText(q); setSearched(true); setShown(PAGE); } }, [params]); // eslint-disable-line react-hooks/exhaustive-deps

  const resumeSkills = useMemo(() => new Set(resumes.flatMap((r) => r.profile.skills)), [resumes]);
  const query: SearchQuery = { text, countries, includeRemote, arrangement, postedWithinDays: posted, hideNoSponsorship: hideNoSponsor, source };
  const results = useMemo(() => {
    if (!index || !searched) return [];
    const rows = filterIndex(index.jobs, query).map((r) => ({ ...r, ov: skillOverlap(r.job, index.skills, resumeSkills) }));
    const t = (p: string | null) => (p ? Date.parse(p) : 0);
    rows.sort((a, b) => {
      if (sort === 'newest') return t(b.job.p) - t(a.job.p);
      if (sort === 'skills') return b.ov.matched.length - a.ov.matched.length || b.rel - a.rel || t(b.job.p) - t(a.job.p);
      return b.rel - a.rel || b.ov.matched.length - a.ov.matched.length || t(b.job.p) - t(a.job.p);
    });
    return rows;
  }, [index, searched, text, countries, includeRemote, arrangement, posted, hideNoSponsor, source, sort, resumeSkills]); // eslint-disable-line react-hooks/exhaustive-deps

  const companies = useMemo(() => new Set(results.map((r) => r.job.c)).size, [results]);
  const okBoards = index?.boards.filter((b) => b.ok).length ?? 0;

  const run = (q: string) => {
    setText(q.trim()); setDraft(q); setSearched(true); setShown(PAGE);
    setParams(q.trim() ? { q: q.trim() } : {}, { replace: true });
  };
  const submit = (e: FormEvent) => { e.preventDefault(); run(draft); };
  const toggleCountry = (c: string) => setCountries((cs) => (cs.includes(c) ? cs.filter((x) => x !== c) : [...cs, c]));

  return (
    <div>
      <PageHeader
        title="Search jobs"
        description={<>Searches open vacancies on {okBoards ? `${okBoards} employers’` : 'employers’'} own careers boards (Greenhouse, Lever, Ashby, SmartRecruiters, Workable, Recruitee). Every result links straight to the employer’s application page, with no job-board middlemen.</>}
      />

      <form onSubmit={submit} className="panel p-3 sm:p-4 mb-4" role="search">
        <div className="flex flex-col sm:flex-row gap-2">
          <div className="relative flex-1">
            <SearchIcon className="size-4 text-faint absolute left-3 top-1/2 -translate-y-1/2" />
            <input ref={inputRef} value={draft} onChange={(e) => setDraft(e.target.value)} autoFocus
              placeholder='Job title, skill or company — e.g. business analyst, "power bi", Monzo'
              aria-label="Search jobs" className="input pl-9 h-11 text-[0.9375rem] w-full" />
          </div>
          <Button type="submit" variant="primary" className="h-11 px-6 text-[0.9375rem]" disabled={!index}><SearchIcon className="size-4" />Search</Button>
        </div>
        <p className="text-xs text-muted mt-2">Separate alternatives with commas: <button type="button" className="text-accent hover:underline" onClick={() => run('business analyst, data analyst, product analyst')}>business analyst, data analyst, product analyst</button></p>

        <div className="flex flex-wrap items-center gap-1.5 mt-3">
          <span className="text-xs text-muted mr-1">Countries</span>
          {prefs.countries.map((c) => (
            <button key={c.code} type="button" onClick={() => toggleCountry(c.code)} aria-pressed={countries.includes(c.code)}
              className={clsx('h-7 px-2.5 rounded-full text-xs border transition-colors', countries.includes(c.code) ? 'bg-accent-soft text-accent border-accent/30' : 'bg-surface text-muted border-line hover:text-ink')}>
              {c.name}
            </button>
          ))}
          <button type="button" className="h-7 px-2 text-xs text-muted hover:text-ink" onClick={() => setCountries([])}>Any country</button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-3">
          <Select aria-label="Work arrangement" value={arrangement} onChange={(e) => setArrangement(e.target.value as WorkArrangement | 'Any')}>
            <option value="Any">Any arrangement</option><option value="Remote">Remote</option><option value="Hybrid">Hybrid</option><option value="On-site">On-site</option>
          </Select>
          <Select aria-label="Posted within" value={posted ?? ''} onChange={(e) => setPosted(e.target.value ? Number(e.target.value) : null)}>
            <option value="3">Posted in last 3 days</option><option value="7">Last 7 days</option><option value="14">Last 14 days</option><option value="30">Last 30 days</option><option value="">Any date (incl. undated)</option>
          </Select>
          <Select aria-label="Source" value={source} onChange={(e) => setSource(e.target.value as AtsSource | 'Any')}>
            <option value="Any">All careers platforms</option>
            {(['greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'recruitee'] as AtsSource[]).map((s) => <option key={s} value={s}>{SOURCE_LABELS[s]}</option>)}
          </Select>
          <Select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)}>
            <option value="relevance">Sort: best title match</option><option value="newest">Sort: newest</option><option value="skills">Sort: most resume skills</option>
          </Select>
        </div>
        <div className="grid sm:grid-cols-2 gap-x-6 mt-1">
          <Toggle checked={includeRemote} onChange={setIncludeRemote} label="Include remote roles" description="Remote jobs with no stated country, or in the countries above." />
          <Toggle checked={hideNoSponsor} onChange={setHideNoSponsor} label="Hide roles that refuse visa sponsorship" description="Removes postings that say no sponsorship or local work rights only." />
        </div>
      </form>

      {loadErr ? (
        <div className="panel"><Empty icon={<AlertTriangle className="size-6" />} title={loadErr === 'NOT_BUILT' ? 'The job index hasn’t been built yet' : 'Couldn’t load the job index'}>
          {loadErr === 'NOT_BUILT' ? 'It is built by the “Deploy dashboard” workflow on GitHub and refreshed every 4 hours. Run that workflow once, then reload this page.' : loadErr}
        </Empty></div>
      ) : !index ? (
        <div className="panel flex items-center justify-center gap-2 py-16 text-sm text-muted"><Spinner />Loading open vacancies…</div>
      ) : !searched ? (
        <div className="panel p-5">
          <p className="text-sm font-medium">{index.jobs.length.toLocaleString()} open vacancies from {okBoards} employers, updated {fmtDateTimeRel(index.builtAt)}.</p>
          <p className="text-sm text-muted mt-1">Type a role and press Search, or start from your target titles:</p>
          <div className="flex flex-wrap gap-1.5 mt-3">
            {prefs.targetTitles.map((t) => <button key={t} className="h-8 px-3 rounded-full text-sm border border-line bg-surface hover:bg-raised" onClick={() => run(t)}>{t}</button>)}
            <button className="h-8 px-3 rounded-full text-sm border border-accent/30 bg-accent-soft text-accent" onClick={() => run(prefs.targetTitles.join(', '))}>All my target titles</button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
            <p className="text-sm text-muted"><b className="text-ink num">{results.length.toLocaleString()}</b> open {results.length === 1 ? 'vacancy' : 'vacancies'} at {companies} {companies === 1 ? 'company' : 'companies'}{text ? <> for “{text}”</> : null} · index updated {fmtDateTimeRel(index.builtAt)}</p>
            <button className="text-xs text-muted hover:text-ink inline-flex items-center gap-1" onClick={() => setShowSources((v) => !v)}><Building2 className="size-3.5" />{showSources ? 'Hide' : 'Show'} the {index.boards.length} employer boards searched</button>
          </div>
          {showSources && <SourcesPanel index={index} />}
          {!resumes.length && <div className="mb-3 rounded-lg border border-line bg-surface p-3 text-sm text-muted">Upload your resume in <b>Resume intelligence</b> to see which of each job’s required skills you already have.</div>}
          {results.length ? (
            <ul className="space-y-2">
              {results.slice(0, shown).map(({ job, ov }) => <ResultCard key={job.id} job={job} matched={ov.matched} missing={ov.missing} hasResume={!!primaryResume} tracked={jobsById.get(job.id)} />)}
            </ul>
          ) : (
            <div className="panel"><Empty icon={<SearchIcon className="size-6" />} title="No open vacancies match">Try fewer words, add alternatives with commas, choose “Any country”, or widen the posting window.</Empty></div>
          )}
          {results.length > shown && <div className="flex justify-center mt-4"><Button onClick={() => setShown((s) => s + PAGE)}>Show {Math.min(PAGE, results.length - shown)} more</Button></div>}
        </>
      )}
    </div>
  );
}

function SourcesPanel({ index }: { index: SearchIndex }) {
  const failed = index.boards.filter((b) => !b.ok);
  return (
    <div className="panel p-4 mb-3 text-sm">
      <p className="text-muted mb-2">Built {fmtDateTimeRel(index.builtAt)} from each employer’s public careers API. {failed.length ? `${failed.length} board${failed.length > 1 ? 's' : ''} could not be read on the last build.` : 'Every board responded on the last build.'}</p>
      <div className="flex flex-wrap gap-1">
        {index.boards.map((b) => <Badge key={b.source + b.token} tone={b.ok ? 'neutral' : 'bad'} title={b.ok ? `${SOURCE_LABELS[b.source]} · ${b.jobs} open jobs` : b.error ?? 'failed'}>{b.name}{b.ok ? <span className="text-faint num">{b.jobs}</span> : ' ✗'}</Badge>)}
      </div>
      <p className="text-xs text-muted mt-3">Want an employer that isn’t here? Add its careers board in <b>Search preferences</b>. It will be included in your scheduled refresh.</p>
    </div>
  );
}

function ResultCard({ job, matched, missing, hasResume, tracked }: { job: IndexJob; matched: string[]; missing: string[]; hasResume: boolean; tracked: ReturnType<ReturnType<typeof useData>['jobsById']['get']> }) {
  const { user } = useAuth();
  const { prefs, resumes, appsByJob } = useData();
  const { toast, openApply, openJob } = useUI();
  const [busy, setBusy] = useState<null | 'save' | 'apply' | 'check'>(null);
  const [check, setCheck] = useState<{ open: boolean | null; note: string } | null>(null);
  const apply = safeUrl(job.u);
  const where = [job.l || (job.k ? COUNTRY_NAMES[job.k] ?? job.k : ''), job.w !== 'Unknown' && !job.l.toLowerCase().includes(job.w.toLowerCase()) ? job.w : null].filter(Boolean).join(' · ') || 'Location not stated';
  const applied = tracked && appsByJob.has(tracked.id);

  const doImport = async (status: ApplicationStatus) => {
    const j = await importIndexJob(user!.uid, job, { prefs, resumes, existing: tracked, status });
    if (tracked && status !== 'Discovered' && tracked.status !== status) await setJobStatus(user!.uid, tracked, status);
    return j;
  };
  const onSave = async () => {
    setBusy('save');
    try {
      if (tracked && ['Saved', 'Shortlisted', 'Ready to Apply'].includes(tracked.status)) { await setJobStatus(user!.uid, tracked, 'Discovered'); toast('Removed from saved jobs'); }
      else { await doImport('Saved'); toast(`Saved: ${job.t} at ${job.c}`); }
    } catch (e) { toast((e as Error).message, 'error'); if (e instanceof ListingClosedError) setCheck({ open: false, note: e.message }); }
    finally { setBusy(null); }
  };
  const onApplied = async () => {
    if (applied) { toast('Already marked as applied.', 'error'); return; }
    setBusy('apply');
    try { const j = await doImport('Discovered'); openApply(j.id); }
    catch (e) { toast((e as Error).message, 'error'); if (e instanceof ListingClosedError) setCheck({ open: false, note: e.message }); }
    finally { setBusy(null); }
  };
  const onCheck = async () => {
    setBusy('check');
    try { const r = await checkStillOpen(job); setCheck({ open: r.open, note: r.note }); }
    finally { setBusy(null); }
  };
  const saved = tracked && ['Saved', 'Shortlisted', 'Ready to Apply'].includes(tracked.status);

  return (
    <li className={clsx('panel p-4', check?.open === false && 'opacity-60')}>
      <div className="flex flex-col md:flex-row md:items-start gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="text-[0.9375rem] font-semibold leading-snug">{job.t}</h3>
            {tracked && <StatusBadge status={tracked.status} />}
          </div>
          <p className="text-sm mt-0.5"><span className="font-medium">{job.c}</span><span className="text-muted"> · <MapPin className="inline size-3 -mt-0.5" /> {where}</span></p>
          <div className="flex flex-wrap items-center gap-1.5 mt-2">
            <Badge tone={job.p && (Date.now() - Date.parse(job.p)) / 86_400_000 <= 7 ? 'accent' : 'neutral'} title={job.p ? `Published ${job.p}` : 'The employer doesn’t publish a posting date'}>{job.p ? `Posted ${relDays(job.p).toLowerCase()}` : 'Date not given'}</Badge>
            {job.sp ? <SponsorshipBadge category={job.sp} /> : <Badge title="Description not included in the board listing; checked when you save">Sponsorship: check posting</Badge>}
            {job.e && <Badge>{job.e}</Badge>}
            {job.y !== null && <Badge title="Experience the posting asks for">{job.y}+ yrs</Badge>}
            <Badge tone="good" title={`Read directly from ${job.c}’s ${SOURCE_LABELS[job.s]} careers board`}><ShieldCheck className="size-3" />Employer listing</Badge>
          </div>
          {hasResume && (matched.length + missing.length > 0) && (
            <p className="text-xs mt-2 text-muted">
              <span className="text-good font-medium">{matched.length}/{matched.length + missing.length} skills on your resume</span>
              {matched.length ? `: ${matched.slice(0, 6).join(', ')}` : ''}{missing.length ? <span> · missing: {missing.slice(0, 4).join(', ')}{missing.length > 4 ? '…' : ''}</span> : null}
            </p>
          )}
          {check && (
            <p className={clsx('text-xs mt-2 inline-flex items-center gap-1', check.open ? 'text-good' : check.open === false ? 'text-bad' : 'text-warn')}>
              {check.open ? <CheckCircle2 className="size-3.5" /> : <AlertTriangle className="size-3.5" />}{check.open ? 'Still open: ' : check.open === false ? 'Closed: ' : ''}{check.note}
            </p>
          )}
        </div>
        <div className="flex flex-wrap md:flex-col md:items-stretch gap-1.5 md:w-48 shrink-0">
          {apply && check?.open !== false && (
            <a href={apply} target="_blank" rel="noopener noreferrer" className="inline-flex h-9 items-center justify-center gap-1.5 rounded-lg bg-accent px-3.5 text-sm font-medium text-white dark:text-[#0f1115] hover:bg-accent/90">
              Apply on {job.c.length > 14 ? 'company' : job.c} site<ExternalLink className="size-3.5" />
            </a>
          )}
          <div className="flex gap-1.5">
            <Button size="sm" className="flex-1" loading={busy === 'save'} onClick={onSave} disabled={check?.open === false && !tracked}>{saved ? <BookmarkCheck className="size-3.5 text-accent" /> : <Bookmark className="size-3.5" />}{saved ? 'Saved' : 'Save'}</Button>
            <Button size="sm" className="flex-1" loading={busy === 'apply'} onClick={onApplied} disabled={!!applied || (check?.open === false && !tracked)}><Send className="size-3.5" />{applied ? 'Applied' : 'Applied?'}</Button>
          </div>
          <div className="flex gap-1.5">
            <Button size="sm" variant="ghost" className="flex-1" loading={busy === 'check'} onClick={onCheck}><RefreshCw className="size-3.5" />Still open?</Button>
            {tracked && <Button size="sm" variant="ghost" className="flex-1" onClick={() => openJob(tracked.id)}>Details</Button>}
          </div>
        </div>
      </div>
    </li>
  );
}
