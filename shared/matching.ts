// Transparent, rules-based resume ↔ vacancy scoring.
// Every point awarded is traceable to text in the vacancy and the resume, which
// is what keeps scores honest. An optional LLM adds narrative (aiAnalysis) but
// never changes the number.
import type { Job, MatchAnalysis, MatchComponents, MatchLabel, MatchResult, ResumeProfile, SponsorshipCategory } from './types';
import { MATCH_WEIGHTS, SPONSORSHIP_LABELS } from './types';
import { detectThemes, extractSkills, isCoreSkill, DOMAIN_SKILLS } from './skills';
import { seniorityOf } from './titles';
import { uniq } from './text';

export const ENGINE_VERSION = 'rules-v1';

export interface ResumeInput {
  id: string;
  name: string;
  text: string;
  profile: ResumeProfile;
}

export type JobInput = Pick<Job, 'title' | 'company' | 'description' | 'country' | 'workArrangement' | 'sponsorship'>;

const EQUIVALENTS: string[][] = [
  ['Power BI', 'Tableau', 'Looker', 'Qlik'],
  ['Snowflake', 'BigQuery', 'Redshift'],
  ['AWS', 'Azure', 'GCP'],
  ['Mixpanel', 'Amplitude', 'Google Analytics'],
  ['Microsoft Excel', 'Google Sheets'],
  ['Python', 'R'],
];

const WORD_NUM: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8, nine: 9, ten: 10 };

export function requiredYears(text: string): number | null {
  const t = text.replace(/\b(one|two|three|four|five|six|seven|eight|nine|ten)\b/gi, (w) => String(WORD_NUM[w.toLowerCase()]));
  const sentences = t.split(/(?<=[.!?\n•])/);
  const pats = [
    /(\d{1,2})\s*\+?\s*(?:-|–|to)\s*\d{1,2}\s*\+?\s*(?:years?|yrs?)/i,
    /(?:at least|minimum(?: of)?|min\.?|over|more than)\s*(\d{1,2})\s*\+?\s*(?:years?|yrs?)/i,
    /(\d{1,2})\s*\+\s*(?:years?|yrs?)/i,
    /(\d{1,2})\s*(?:years?|yrs?)(?:'|’)?\s*(?:of\s+)?(?:relevant\s+|professional\s+|work\s+|hands[- ]on\s+|industry\s+|proven\s+)?(?:experience|exp\b)/i,
  ];
  for (const s of sentences) {
    if (!/experience|exp\b|background/i.test(s)) continue;
    for (const re of pats) {
      const m = re.exec(s);
      if (m) {
        const n = parseInt(m[1], 10);
        if (n >= 0 && n <= 20) return n;
      }
    }
  }
  return null;
}

type EduReq = 'none' | 'bachelor' | 'master' | 'phd';
export function educationRequirement(text: string): { level: EduReq; field: string | null; raw: string | null } {
  const sentences = text.split(/(?<=[.!?\n•])/);
  let level: EduReq = 'none';
  let raw: string | null = null;
  let field: string | null = null;
  for (const s of sentences) {
    const optional = /\b(preferred|a plus|plus|nice to have|desirable|advantageous|bonus|or equivalent( practical)? experience|or relevant experience)\b/i.test(s);
    let found: EduReq | null = null;
    if (/\b(phd|ph\.d|doctorate)\b/i.test(s)) found = 'phd';
    else if (/\b(master'?s|mba|msc|m\.sc|postgraduate)\b/i.test(s)) found = 'master';
    else if (/\b(bachelor'?s?|undergraduate|university degree|degree in|ba\/bs|bs\/ba|graduate degree|college degree)\b/i.test(s)) found = 'bachelor';
    if (found) {
      const effective: EduReq = optional && found !== 'bachelor' ? 'bachelor' : found;
      const rank = { none: 0, bachelor: 1, master: 2, phd: 3 };
      if (rank[effective] > rank[level]) { level = effective; raw = s.trim().slice(0, 220); }
      const f = /\b(computer science|statistics|mathematics|economics|engineering|business|finance|data science|information systems|quantitative)\b/i.exec(s);
      if (f && !field) field = f[1].toLowerCase();
    }
  }
  return { level, field, raw };
}

function label(score: number): MatchLabel {
  if (score >= 90) return 'Excellent';
  if (score >= 80) return 'Strong';
  if (score >= 70) return 'Good';
  if (score >= 60) return 'Moderate';
  return 'Low';
}

function sponsorshipText(cat: SponsorshipCategory, requiresSponsorship: boolean, evidence: string | null): string {
  const ev = evidence ? ` The posting says: “${evidence}”.` : '';
  switch (cat) {
    case 'N': return 'India-based role — no sponsorship needed.';
    case 'A': return `The employer states sponsorship is available for this role.${ev}`;
    case 'B': return `The posting hints at relocation or visa support but doesn't commit to sponsorship. Confirm with the recruiter before investing heavily.${ev}`;
    case 'C': return requiresSponsorship
      ? 'The posting doesn’t mention sponsorship either way. Check the company’s sponsor status (e.g. UK Register of Licensed Sponsors) or ask the recruiter early.'
      : 'Sponsorship isn’t mentioned.';
    case 'D': return `The employer explicitly does not sponsor visas — not suitable for relocation.${ev}`;
    case 'E': return `The role requires existing local work authorization you don’t currently hold.${ev}`;
  }
}

export function scoreJob(job: JobInput, resume: ResumeInput, opts: { requiresSponsorship?: boolean; now?: Date } = {}): MatchResult {
  const requiresSponsorship = opts.requiresSponsorship ?? true;
  const now = opts.now ?? new Date();
  const p = resume.profile;
  const jdText = `${job.title}\n${job.description}`;
  const notes: MatchResult['notes'] = {};

  // ---- Skills (30) -------------------------------------------------------
  const jdSkillsAll = extractSkills(jdText);
  const jdSkills = jdSkillsAll.filter((s) => !DOMAIN_SKILLS.includes(s));
  const have = new Set([...p.skills, ...extractSkills(resume.text)]);
  let wTotal = 0;
  let wGot = 0;
  const matched: string[] = [];
  const missing: string[] = [];
  for (const s of jdSkills) {
    const w = isCoreSkill(s) ? 2 : 1;
    wTotal += w;
    if (have.has(s)) { wGot += w; matched.push(s); continue; }
    const eq = EQUIVALENTS.find((g) => g.includes(s));
    const alt = eq?.find((x) => x !== s && have.has(x));
    if (alt) { wGot += w * 0.5; missing.push(s); notes.skills = `${notes.skills ? notes.skills + ' ' : ''}Partial credit: ${alt} for ${s}.`; continue; }
    missing.push(s);
  }
  let skills: number;
  if (wTotal === 0) { skills = 12; notes.skills = 'The posting names few recognisable tools or skills, so this component is neutral.'; }
  else skills = (wGot / wTotal) * MATCH_WEIGHTS.skills;

  // ---- Experience (25) -----------------------------------------------------
  const req = requiredYears(job.description);
  const cand = p.totalYears;
  const seniority = seniorityOf(job.title);
  let experience: number;
  if (cand === null) { experience = 12; notes.experience = 'Couldn’t read employment dates from the resume — add dates to improve accuracy.'; }
  else if (req !== null) {
    const diff = cand - req;
    experience = diff >= 0 ? 25 : diff > -1 ? 20 : diff > -2 ? 14 : diff > -3 ? 8 : 3;
    notes.experience = `Asks for ${req}+ years; resume shows about ${cand}.`;
  } else {
    if (seniority === 'entry') experience = 25;
    else if (seniority === 'mid') experience = cand >= 2 ? 22 : cand >= 1 ? 16 : 10;
    else experience = cand >= 5 ? 22 : cand >= 3 ? 13 : 7;
    notes.experience = `No explicit years stated; judged from a ${seniority}-level title against about ${cand} years.`;
  }

  // ---- Responsibilities (20) ----------------------------------------------
  const jdThemes = detectThemes(job.description);
  const cvThemes = new Set(detectThemes(resume.text));
  const sharedThemes = jdThemes.filter((t) => cvThemes.has(t));
  const responsibilities = jdThemes.length ? (sharedThemes.length / jdThemes.length) * MATCH_WEIGHTS.responsibilities : 10;
  if (!jdThemes.length) notes.responsibilities = 'Responsibilities weren’t specific enough to compare.';

  // ---- Education (10) ------------------------------------------------------
  const edu = educationRequirement(job.description);
  let education: number;
  if (edu.level === 'none') education = p.hasBachelor ? 10 : 7;
  else if (edu.level === 'bachelor') education = p.hasBachelor ? 10 : 3;
  else if (edu.level === 'master') education = p.hasMaster ? 10 : 4;
  else education = 1;
  if (edu.field && education === 10 && !p.degreeFields.some((f) => f.includes(edu.field!) || edu.field!.includes(f.split(' ')[0]))) {
    if (!['business', 'quantitative'].includes(edu.field) || !p.degreeFields.some((f) => /business|commerce|economics|statistics|mathematics/.test(f))) {
      education = 7;
      notes.education = `Prefers a ${edu.field} degree.`;
    }
  }

  // ---- Industry (10) -------------------------------------------------------
  const jdDomains = jdSkillsAll.filter((s) => DOMAIN_SKILLS.includes(s));
  const cvDomains = new Set(p.industries);
  let industry: number;
  if (!jdDomains.length) { industry = 7; notes.industry = 'Domain-agnostic analytics role.'; }
  else if (jdDomains.some((d) => cvDomains.has(d))) { industry = 10; notes.industry = `Shared domain: ${jdDomains.filter((d) => cvDomains.has(d)).join(', ')}.`; }
  else { industry = 4; notes.industry = `Domain is ${jdDomains.join(', ')}, which your resume doesn’t show.`; }

  // ---- Location & work authorization (5) ---------------------------------
  const cat = job.sponsorship.category;
  let location: number;
  if (!requiresSponsorship || cat === 'N') location = 5;
  else if (!job.country && job.workArrangement === 'Remote') location = cat === 'D' || cat === 'E' ? 0 : 3;
  else location = { A: 5, B: 3, C: 2, D: 0, E: 0, N: 5 }[cat];

  const components: MatchComponents = {
    skills: round1(skills), experience: round1(experience), responsibilities: round1(responsibilities),
    education: round1(education), industry: round1(industry), location: round1(location),
  };
  const score = Math.round(Object.values(components).reduce((a, b) => a + b, 0));

  const analysis = buildAnalysis({
    job, p, score, components, matched, missing, req, cand, seniority, sharedThemes,
    missingThemes: jdThemes.filter((t) => !cvThemes.has(t)), edu, jdDomains, cvDomains, requiresSponsorship,
  });

  return {
    score, label: label(score), components, notes, matchedSkills: matched, missingSkills: missing,
    requiredYears: req, candidateYears: cand, analysis, aiAnalysis: null, resumeVersionId: resume.id,
    perVersion: { [resume.id]: score }, computedAt: now.toISOString(), engine: ENGINE_VERSION,
  };
}

function round1(n: number) { return Math.round(n * 10) / 10; }

interface Ctx {
  job: JobInput; p: ResumeProfile; score: number; components: MatchComponents; matched: string[]; missing: string[];
  req: number | null; cand: number | null; seniority: 'entry' | 'mid' | 'senior'; sharedThemes: string[]; missingThemes: string[];
  edu: ReturnType<typeof educationRequirement>; jdDomains: string[]; cvDomains: Set<string>; requiresSponsorship: boolean;
}

function buildAnalysis(c: Ctx): MatchAnalysis {
  const cat = c.job.sponsorship.category;
  const blocked = c.requiresSponsorship && (cat === 'D' || cat === 'E');
  const coreMissing = c.missing.filter(isCoreSkill);
  const total = c.matched.length + c.missing.length;

  const suitability = [
    total ? `You cover ${c.matched.length} of the ${total} skills this posting names${c.matched.length ? ` (${c.matched.slice(0, 5).join(', ')})` : ''}.` : 'The posting lists few specific skills.',
    c.cand !== null ? (c.req !== null
      ? `Your ~${c.cand} years ${c.cand >= c.req ? 'meet' : 'fall short of'} the ${c.req}+ years requested.`
      : `Your ~${c.cand} years fit a ${c.seniority}-level title ${c.components.experience >= 20 ? 'well' : 'only partly'}.`) : '',
    c.sharedThemes.length ? `Day-to-day overlap: ${c.sharedThemes.slice(0, 3).join('; ').toLowerCase()}.` : '',
  ].filter(Boolean).join(' ');

  const matches = uniq([
    ...c.matched.map((s) => `${s} is on your resume and requested here.`),
    ...c.sharedThemes.map((t) => `${t} — you have done this.`),
  ]).slice(0, 8);

  const experienceGaps: string[] = [];
  if (c.req !== null && c.cand !== null && c.cand < c.req) experienceGaps.push(`Requests ${c.req}+ years; you have about ${c.cand}.`);
  if (c.seniority === 'senior' && (c.cand ?? 0) < 5) experienceGaps.push('Senior-level title; most hires at this level have 5+ years.');
  c.missingThemes.slice(0, 3).forEach((t) => experienceGaps.push(`No clear evidence on your resume for: ${t.toLowerCase()}.`));
  if (c.jdDomains.length && !c.jdDomains.some((d) => c.cvDomains.has(d))) experienceGaps.push(`No direct ${c.jdDomains.join('/')} industry experience.`);

  const rejectionRisks: string[] = [];
  if (blocked) rejectionRisks.push(cat === 'D' ? 'Employer does not sponsor visas.' : 'Requires existing local work authorization.');
  else if (c.requiresSponsorship && cat === 'C') rejectionRisks.push('Sponsorship unclear — many employers filter out candidates who need it.');
  if (coreMissing.length) rejectionRisks.push(`Missing core requirement${coreMissing.length > 1 ? 's' : ''}: ${coreMissing.join(', ')}.`);
  if (c.req !== null && c.cand !== null && c.req - c.cand >= 2) rejectionRisks.push('Experience gap of 2+ years is a common screening cut-off.');
  if (c.edu.level === 'master' && !c.p.hasMaster) rejectionRisks.push('Asks for a master’s degree.');
  if (c.edu.level === 'phd') rejectionRisks.push('Asks for a PhD.');
  if (!rejectionRisks.length) rejectionRisks.push('No major screening risks detected from the posting text.');

  let verdict: MatchAnalysis['worthIt']['verdict'];
  let reason: string;
  if (blocked) { verdict = 'Skip'; reason = 'Sponsorship or work authorization rules you out for relocation.'; }
  else if (c.score >= 75 && coreMissing.length <= 1) { verdict = 'Apply'; reason = 'Strong overlap and no hard blockers.'; }
  else if (c.score >= 60) { verdict = 'Consider'; reason = coreMissing.length ? `Reasonable fit, but expect questions on ${coreMissing[0]}.` : 'Moderate fit — worth a tailored application if the company appeals to you.'; }
  else { verdict = 'Skip'; reason = 'Low overlap with your current resume; time is better spent on stronger matches.'; }

  const recs: string[] = [];
  if (c.matched.length) recs.push(`Lead your summary with ${c.matched.slice(0, 3).join(', ')} — the skills this posting and your resume share.`);
  if (coreMissing.length) recs.push(`If you have genuine exposure to ${coreMissing[0]}, add a concrete bullet showing it; if not, address the gap honestly in the cover letter.`);
  if (c.missingThemes.length) recs.push(`Rephrase a relevant achievement to show “${c.missingThemes[0].toLowerCase()}”, using only work you actually did.`);
  if (c.sharedThemes.length) recs.push(`Quantify a bullet on ${c.sharedThemes[0].toLowerCase()} (time saved, accuracy, number of stakeholders or reports).`);
  if (c.requiresSponsorship && (cat === 'B' || cat === 'C')) recs.push('State your visa sponsorship need clearly and early so the recruiter can confirm eligibility.');
  if (c.jdDomains.length && !c.jdDomains.some((d) => c.cvDomains.has(d))) recs.push(`Show transferable context for ${c.jdDomains[0]} (e.g. similar data, users or processes you’ve handled).`);
  recs.push('Mirror the posting’s wording for tools and outcomes where it accurately describes your work.');

  return {
    suitability,
    matches,
    missingSkills: c.missing,
    experienceGaps: experienceGaps.length ? experienceGaps : ['No significant experience gaps detected.'],
    rejectionRisks,
    sponsorship: `${SPONSORSHIP_LABELS[cat]}. ${sponsorshipText(cat, c.requiresSponsorship, c.job.sponsorship.evidence)}`,
    worthIt: { verdict, reason },
    recommendations: uniq(recs).slice(0, 3),
  };
}

/** Score against every resume version; return the best one and the per-version scores. */
export function scoreAcrossVersions(job: JobInput, versions: ResumeInput[], opts: { requiresSponsorship?: boolean; now?: Date } = {}): MatchResult | null {
  if (!versions.length) return null;
  const results = versions.map((v) => scoreJob(job, v, opts));
  const perVersion: Record<string, number> = {};
  versions.forEach((v, i) => { perVersion[v.id] = results[i].score; });
  const best = results.reduce((a, b) => (b.score > a.score ? b : a));
  return { ...best, perVersion };
}

export function jobDetailsFromText(description: string) {
  const req = requiredYears(description);
  const edu = educationRequirement(description);
  return {
    requiredSkills: extractSkills(description).filter((s) => !DOMAIN_SKILLS.includes(s)),
    experienceRequired: req !== null ? `${req}+ years` : null,
    educationRequired: edu.level === 'none' ? null : edu.raw,
  };
}
