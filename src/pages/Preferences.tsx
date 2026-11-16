import { useEffect, useState } from 'react';
import { Plus, Trash2, X } from 'lucide-react';
import { useData } from '@/context/DataContext';
import { useAuth } from '@/context/AuthContext';
import { useUI } from '@/context/UIContext';
import { PageHeader, Section, Button, Input, Select, Toggle, Field, Badge } from '@/components/ui';
import { savePreferences } from '@/lib/db';
import { COUNTRY_NAMES } from '@shared/geo';
import { defaultPreferences } from '@shared/defaults';
import type { BoardRef, Preferences as P } from '@shared/types';

export function Preferences() {
  const { prefs, prefsSaved, refresh } = useData();
  const { user } = useAuth();
  const { toast } = useUI();
  const [p, setP] = useState<P>(prefs);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [title, setTitle] = useState('');
  const [exclude, setExclude] = useState('');
  const [board, setBoard] = useState<BoardRef>({ source: 'greenhouse', token: '', name: '', website: '' });
  useEffect(() => { if (!dirty) setP(prefs); }, [prefs, dirty]);
  const upd = (patch: Partial<P>) => { setP({ ...p, ...patch }); setDirty(true); };
  const save = async () => {
    setSaving(true);
    try { await savePreferences(user!.uid, p); setDirty(false); toast('Preferences saved — they apply from the next refresh'); }
    catch (e) { toast((e as Error).message, 'error'); } finally { setSaving(false); }
  };
  const boardErrors = Object.values(refresh?.sources ?? {}).flatMap((s) => s.errors).filter((e) => /not found/i.test(e));
  const addable = Object.keys(COUNTRY_NAMES).filter((c) => !p.countries.some((x) => x.code === c));

  return (
    <div className="space-y-6 pb-20">
      <PageHeader title="Search preferences" description="Where to look, what to look for and which employers to watch. The refresh job reads these on every run."
        actions={<Button variant="primary" onClick={save} loading={saving} disabled={!dirty && prefsSaved}>{prefsSaved ? 'Save changes' : 'Save preferences'}</Button>} />
      {!prefsSaved && <div className="rounded-lg border border-accent/30 bg-accent-soft/60 p-3 text-sm">These are the starting defaults. Save them once so the refresh job uses your settings.</div>}

      <Section title="Countries and priority">
        <p className="text-xs text-muted mb-3">Priority 1 countries are searched first and get a “top-priority country” reason in recommendations. Disabled countries are ignored entirely.</p>
        <div className="divide-y divide-line border border-line rounded-lg">
          {[...p.countries].sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name)).map((c) => (
            <div key={c.code} className="flex items-center gap-3 px-3 py-2">
              <input type="checkbox" aria-label={`Search ${c.name}`} className="accent-[rgb(var(--accent))]" checked={c.enabled} onChange={(e) => upd({ countries: p.countries.map((x) => x.code === c.code ? { ...x, enabled: e.target.checked } : x) })} />
              <span className={`flex-1 text-sm ${c.enabled ? '' : 'text-muted'}`}>{c.name}</span>
              <Select aria-label={`${c.name} priority`} className="w-36 h-8" value={c.priority} onChange={(e) => upd({ countries: p.countries.map((x) => x.code === c.code ? { ...x, priority: Number(e.target.value) as 1 | 2 | 3 } : x) })}>
                <option value={1}>Priority 1</option><option value={2}>Priority 2</option><option value={3}>Priority 3</option>
              </Select>
              <button aria-label={`Remove ${c.name}`} className="size-8 inline-flex items-center justify-center text-faint hover:text-bad" onClick={() => upd({ countries: p.countries.filter((x) => x.code !== c.code) })}><X className="size-4" /></button>
            </div>
          ))}
        </div>
        {addable.length > 0 && (
          <Select className="mt-3 w-60" value="" onChange={(e) => e.target.value && upd({ countries: [...p.countries, { code: e.target.value, name: COUNTRY_NAMES[e.target.value], priority: 3, enabled: true }] })} aria-label="Add a country">
            <option value="">Add a country…</option>
            {addable.map((c) => <option key={c} value={c}>{COUNTRY_NAMES[c]}</option>)}
          </Select>
        )}
        <div className="mt-4 border-t border-line pt-2">
          <Toggle checked={p.requiresSponsorship} onChange={(v) => upd({ requiresSponsorship: v })} label="I need visa sponsorship outside India" description="Roles that refuse sponsorship or need local work authorization are excluded from recommendations and score 0 on location." />
        </div>
      </Section>

      <Section title="Job titles">
        <p className="text-xs text-muted mb-3">Used as search queries for job APIs. Company boards are filtered by a broader analyst-role matcher, so equivalent titles (e.g. “Insights Analyst”, “MIS Analyst”) are still found.</p>
        <div className="flex flex-wrap gap-1.5">
          {p.targetTitles.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-md bg-raised border border-line pl-2 pr-1 h-7 text-[0.8125rem]">{t}<button aria-label={`Remove ${t}`} className="size-5 inline-flex items-center justify-center rounded text-faint hover:text-bad" onClick={() => upd({ targetTitles: p.targetTitles.filter((x) => x !== t) })}><X className="size-3" /></button></span>)}
        </div>
        <form className="mt-3 flex gap-2 max-w-md" onSubmit={(e) => { e.preventDefault(); if (title.trim() && !p.targetTitles.includes(title.trim())) upd({ targetTitles: [...p.targetTitles, title.trim()] }); setTitle(''); }}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Add a job title" maxLength={80} />
          <Button type="submit"><Plus className="size-4" />Add</Button>
        </form>
        <h3 className="text-[0.8125rem] font-semibold mt-6 mb-2">Exclude titles containing</h3>
        <div className="flex flex-wrap gap-1.5">
          {p.excludeTitleKeywords.map((t) => <span key={t} className="inline-flex items-center gap-1 rounded-md bg-bad/5 border border-bad/20 pl-2 pr-1 h-7 text-[0.8125rem]">{t}<button aria-label={`Remove ${t}`} className="size-5 inline-flex items-center justify-center rounded text-faint hover:text-bad" onClick={() => upd({ excludeTitleKeywords: p.excludeTitleKeywords.filter((x) => x !== t) })}><X className="size-3" /></button></span>)}
          {!p.excludeTitleKeywords.length && <span className="text-sm text-muted">Nothing excluded beyond the built-in filters (security, finance-specialist, director-level and similar).</span>}
        </div>
        <form className="mt-3 flex gap-2 max-w-md" onSubmit={(e) => { e.preventDefault(); if (exclude.trim()) upd({ excludeTitleKeywords: [...new Set([...p.excludeTitleKeywords, exclude.trim()])] }); setExclude(''); }}>
          <Input value={exclude} onChange={(e) => setExclude(e.target.value)} placeholder="e.g. Senior, Contract, SAP" maxLength={40} />
          <Button type="submit"><Plus className="size-4" />Exclude</Button>
        </form>
      </Section>

      <Section title="Freshness and recommendations">
        <Toggle checked={p.includeOlder} onChange={(v) => upd({ includeOlder: v })} label="Include vacancies older than 30 days" description="Only those still listed on the employer’s own careers board. Off by default." />
        <Toggle checked={p.includeUndated} onChange={(v) => upd({ includeUndated: v })} label="Include vacancies without a posting date" description="Some employer boards don’t publish one. Dates are never guessed." />
        <div className="grid sm:grid-cols-2 gap-4 mt-3">
          <Field label="Minimum match for “Recommended”" hint="70 = Good match or better."><Input type="number" min={0} max={100} value={p.minRecommendedScore} onChange={(e) => upd({ minRecommendedScore: Math.max(0, Math.min(100, Number(e.target.value))) })} /></Field>
          <Field label="Max API queries per source per run" hint="Keeps you inside free-tier limits."><Input type="number" min={1} max={100} value={p.maxQueriesPerSource} onChange={(e) => upd({ maxQueriesPerSource: Math.max(1, Math.min(100, Number(e.target.value))) })} /></Field>
        </div>
      </Section>

      <Section title="Employer career boards">
        <p className="text-xs text-muted mb-3 max-w-[76ch]">These are the most reliable source: jobs come straight from the employer’s applicant tracking system, so they’re verified and link to the real application page. Find the identifier in the careers URL — <code>boards.greenhouse.io/<b>acme</b></code>, <code>jobs.lever.co/<b>acme</b></code> (prefix <code>eu:</code> for jobs.eu.lever.co), <code>jobs.ashbyhq.com/<b>acme</b></code>.</p>
        {boardErrors.length > 0 && <div className="mb-3 rounded-lg border border-warn/30 bg-warn/5 p-3 text-sm"><p className="font-medium text-warn">Last refresh couldn’t find some boards</p><ul className="mt-1 text-muted text-xs space-y-0.5">{boardErrors.map((e) => <li key={e}>{e}</li>)}</ul></div>}
        <div className="border border-line rounded-lg divide-y divide-line">
          {p.boards.map((b) => (
            <div key={b.source + b.token} className="flex items-center gap-3 px-3 py-2 text-sm">
              <Badge>{b.source}</Badge>
              <span className="font-medium">{b.name || b.token}</span>
              <code className="text-xs text-muted">{b.token}</code>
              <span className="flex-1" />
              <button aria-label={`Remove ${b.token}`} className="size-8 inline-flex items-center justify-center text-faint hover:text-bad" onClick={() => upd({ boards: p.boards.filter((x) => !(x.source === b.source && x.token === b.token)) })}><Trash2 className="size-4" /></button>
            </div>
          ))}
          {!p.boards.length && <p className="px-3 py-4 text-sm text-muted">No boards tracked.</p>}
        </div>
        <form className="mt-3 grid sm:grid-cols-[8rem_1fr_1fr_1fr_auto] gap-2" onSubmit={(e) => {
          e.preventDefault();
          const token = board.token.trim().toLowerCase();
          if (!token || p.boards.some((x) => x.source === board.source && x.token === token)) return;
          upd({ boards: [...p.boards, { source: board.source, token, name: board.name?.trim() || null, website: board.website?.trim() || null }] });
          setBoard({ ...board, token: '', name: '', website: '' });
        }}>
          <Select value={board.source} onChange={(e) => setBoard({ ...board, source: e.target.value as BoardRef['source'] })} aria-label="ATS"><option value="greenhouse">Greenhouse</option><option value="lever">Lever</option><option value="ashby">Ashby</option></Select>
          <Input placeholder="Board identifier" value={board.token} onChange={(e) => setBoard({ ...board, token: e.target.value })} aria-label="Board identifier" />
          <Input placeholder="Company name (optional)" value={board.name ?? ''} onChange={(e) => setBoard({ ...board, name: e.target.value })} aria-label="Company name" />
          <Input placeholder="https://company.com (optional)" value={board.website ?? ''} onChange={(e) => setBoard({ ...board, website: e.target.value })} aria-label="Company website" />
          <Button type="submit"><Plus className="size-4" />Add</Button>
        </form>
      </Section>

      <Section title="Job search APIs">
        <Toggle checked={p.aggregators.adzuna} onChange={(v) => upd({ aggregators: { ...p.aggregators, adzuna: v } })} label="Adzuna" description="UK, Australia, India, US, Germany, Netherlands and more. Free developer key; needs ADZUNA_APP_ID and ADZUNA_APP_KEY secrets. Listings stay Unverified unless the same job is found on an employer board." />
        <Toggle checked={p.aggregators.reed} onChange={(v) => upd({ aggregators: { ...p.aggregators, reed: v } })} label="Reed.co.uk" description="UK only. Free API key; needs the REED_API_KEY secret." />
        {refresh?.sources && (
          <div className="mt-3 grid sm:grid-cols-2 gap-2">
            {Object.entries(refresh.sources).map(([k, s]) => <div key={k} className="text-xs rounded-lg border border-line px-3 py-2"><span className="font-medium capitalize">{k}</span>: <span className={s.ok ? 'text-good' : 'text-bad'}>{s.ok ? 'working' : 'failing'}</span>, {s.fetched} fetched last run{s.errors.length ? ` — ${s.errors.length} issue${s.errors.length > 1 ? 's' : ''}` : ''}</div>)}
          </div>
        )}
      </Section>

      <div className="flex justify-between">
        <Button variant="ghost" onClick={() => { if (confirm('Reset all search preferences to defaults?')) { setP(defaultPreferences()); setDirty(true); } }}>Reset to defaults</Button>
      </div>

      {dirty && (
        <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 panel shadow-pop px-4 py-2.5 flex items-center gap-3 anim-pop">
          <span className="text-sm">You have unsaved changes</span>
          <Button size="sm" variant="ghost" onClick={() => { setP(prefs); setDirty(false); }}>Discard</Button>
          <Button size="sm" variant="primary" onClick={save} loading={saving}>Save changes</Button>
        </div>
      )}
    </div>
  );
}
