import type { EducationEntry, ExperienceEntry, ResumeProfile } from './types';
import { extractSkills, DOMAIN_SKILLS } from './skills';
import { uniq } from './text';

const MONTHS: Record<string, number> = {
  jan: 1, feb: 2, mar: 3, apr: 4, may: 5, jun: 6, jul: 7, aug: 8, sep: 9, sept: 9, oct: 10, nov: 11, dec: 12,
};
const MONTH_RE = '(jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*\\.?';
const POINT_RE = `(?:${MONTH_RE}\\s*,?\\s*(\\d{4})|(\\d{1,2})\\s*[/.-]\\s*(\\d{4})|(\\d{4}))`;
const END_RE = `(present|current|now|till date|to date|ongoing|${POINT_RE})`;
const RANGE = new RegExp(`${POINT_RE}\\s*(?:-|–|—|to|until)\\s*${END_RE}`, 'i');

function toYm(m: RegExpExecArray, offset: number): string | null {
  const mon = m[offset];
  const y1 = m[offset + 1];
  const mNum = m[offset + 2];
  const y2 = m[offset + 3];
  const yOnly = m[offset + 4];
  if (mon && y1) return `${y1}-${String(MONTHS[mon.toLowerCase().slice(0, 4).replace(/\.$/, '')] ?? MONTHS[mon.toLowerCase().slice(0, 3)]).padStart(2, '0')}`;
  if (mNum && y2) return `${y2}-${String(Math.min(12, Math.max(1, +mNum))).padStart(2, '0')}`;
  if (yOnly) return `${yOnly}-01`;
  return null;
}

export function parseRange(line: string): { start: string | null; end: string | null; matched: string } | null {
  const m = RANGE.exec(line);
  if (!m) return null;
  const start = toYm(m, 1);
  const endWord = m[6];
  const isPresent = endWord && /present|current|now|till date|to date|ongoing/i.test(endWord);
  const end = isPresent ? null : toYm(m, 7);
  return { start, end, matched: m[0] };
}

function monthsBetween(a: string, b: string | null, now: Date): number {
  const [ay, am] = a.split('-').map(Number);
  const [by, bm] = b ? b.split('-').map(Number) : [now.getFullYear(), now.getMonth() + 1];
  return Math.max(0, (by - ay) * 12 + (bm - am) + 1);
}

/** Merge overlapping experience ranges and return total years (one decimal). */
export function totalYears(entries: ExperienceEntry[], now = new Date()): number | null {
  const ranges = entries
    .filter((e) => e.start)
    .map((e) => {
      const [sy, sm] = e.start!.split('-').map(Number);
      const s = sy * 12 + sm;
      const months = monthsBetween(e.start!, e.end, now);
      return [s, s + months - 1] as [number, number];
    })
    .sort((a, b) => a[0] - b[0]);
  if (!ranges.length) return null;
  let total = 0;
  let [cs, ce] = ranges[0];
  for (const [s, e] of ranges.slice(1)) {
    if (s <= ce + 1) ce = Math.max(ce, e);
    else { total += ce - cs + 1; cs = s; ce = e; }
  }
  total += ce - cs + 1;
  return Math.round((total / 12) * 10) / 10;
}

const SECTION_HEADS: [string, RegExp][] = [
  ['experience', /^(professional\s+|work\s+)?(experience|employment( history)?|work history|career history)\s*:?$/i],
  ['education', /^(education|academic (background|qualifications)|qualifications)\s*:?$/i],
  ['skills', /^((technical|core|key)\s+)?(skills|competencies|expertise|tools)( & tools| and tools)?\s*:?$/i],
  ['certifications', /^(certifications?|certificates|licen[cs]es( & certifications)?|courses|training)\s*:?$/i],
  ['achievements', /^(achievements|accomplishments|awards|honou?rs|key achievements)\s*:?$/i],
  ['projects', /^(projects|key projects|academic projects)\s*:?$/i],
  ['summary', /^(summary|profile|professional summary|career objective|objective|about me)\s*:?$/i],
];

function splitSections(lines: string[]): Record<string, string[]> {
  const out: Record<string, string[]> = { header: [] };
  let cur = 'header';
  for (const raw of lines) {
    const line = raw.trim();
    if (!line) continue;
    const head = line.length < 48 ? SECTION_HEADS.find(([, re]) => re.test(line.replace(/[^\w &]/g, '').trim())) : undefined;
    if (head) { cur = head[0]; out[cur] = out[cur] ?? []; continue; }
    (out[cur] = out[cur] ?? []).push(line);
  }
  return out;
}

const DEGREE_RE = /\b(bachelor|bba|b\.?b\.?a|b\.?com|b\.?sc|b\.?tech|b\.?e\b|b\.?a\b|ba \(|bs\b|undergraduate|master|mba|m\.?sc|m\.?com|m\.?tech|ms\b|ma\b|phd|ph\.d|doctorate|diploma|pgdm|post ?graduate)/i;
const INSTITUTION_RE = /\b(university|college|institute|school|academy|iim|iit|gitam)\b/i;

function parseExperience(lines: string[]): ExperienceEntry[] {
  const entries: ExperienceEntry[] = [];
  lines.forEach((line, i) => {
    const r = parseRange(line);
    if (!r || !r.start) return;
    const rest = line.replace(r.matched, '').replace(/[|•·,–—-]\s*$/, '').replace(/^\s*[|•·,–—-]\s*/, '').trim();
    const context = [rest, lines[i - 1] ?? '', lines[i - 2] ?? ''].filter((l) => l && !parseRange(l) && !/^[•\-*]/.test(l));
    const parts = context.join(' | ').split(/\s*(?:\||,|–|—| - | at | @ )\s*/).filter(Boolean);
    const titleIdx = parts.findIndex((p) => /analyst|manager|associate|consultant|executive|intern|specialist|coordinator|engineer|officer|lead|assistant|developer|scientist/i.test(p));
    const title = titleIdx >= 0 ? parts[titleIdx] : parts[0] ?? '';
    const company = parts.find((p, k) => k !== titleIdx && /llp|ltd|limited|pvt|inc|services|consult|solutions|technolog|group|university|bank|corp|company|&/i.test(p)) ?? parts.find((_, k) => k !== titleIdx) ?? '';
    entries.push({ title: title.slice(0, 120), company: company.slice(0, 120), start: r.start, end: r.end, raw: [lines[i - 1], line].filter(Boolean).join(' / ').slice(0, 300) });
  });
  return entries;
}

function parseEducation(lines: string[]): EducationEntry[] {
  const out: EducationEntry[] = [];
  lines.forEach((line, i) => {
    if (!DEGREE_RE.test(line)) return;
    const neighbour = [lines[i - 1], lines[i + 1]].find((l) => l && INSTITUTION_RE.test(l));
    const inst = INSTITUTION_RE.test(line) ? line : neighbour ?? '';
    const period = /\b(19|20)\d{2}\b/.exec(line + ' ' + (neighbour ?? ''));
    out.push({ degree: line.slice(0, 160), institution: inst.slice(0, 160), period: period ? period[0] : null, raw: line });
  });
  return out.slice(0, 6);
}

function suggestTitles(skills: string[]): string[] {
  const has = (s: string) => skills.includes(s);
  const t: string[] = [];
  if (has('Business Analysis') || has('Requirements Gathering')) t.push('Business Analyst');
  if (has('SQL') || has('Data Analysis')) t.push('Data Analyst');
  if (has('Power BI') || has('Tableau') || has('Business Intelligence')) t.push('Business Intelligence Analyst');
  if (has('Reporting') || has('KPI Analysis')) t.push('Reporting Analyst', 'MIS Analyst');
  if (has('Operations Management') || has('Process Improvement')) t.push('Operations Analyst', 'Business Operations Analyst');
  if (has('Product Analytics') || has('A/B Testing')) t.push('Product Analyst');
  if (has('People Analytics')) t.push('People Analytics Analyst');
  if (has('Research & Insights') || has('Strategy')) t.push('Strategy Analyst', 'Insights Analyst');
  if (has('Python') && has('Statistics') && has('Machine Learning')) t.push('Junior Data Scientist');
  return uniq(t);
}

export function parseResumeText(text: string, now = new Date()): ResumeProfile {
  const lines = text.split(/\r?\n/).map((l) => l.replace(/\s+/g, ' ').trim());
  const sections = splitSections(lines);
  const email = /[\w.+-]+@[\w-]+\.[\w.-]+/.exec(text)?.[0] ?? null;
  const phone = /(\+?\d[\d\s().-]{8,}\d)/.exec(text)?.[0]?.trim() ?? null;
  const headerLines = (sections.header ?? []).filter((l) => !l.includes('@') && !/\d{5,}/.test(l));
  const name = headerLines.find((l) => /^[A-Za-z][A-Za-z .'-]{2,40}$/.test(l) && l.split(' ').length <= 5) ?? null;
  const headline = headerLines.find((l) => l !== name && l.length < 90 && /analyst|analytics|business|data|operations/i.test(l)) ?? null;

  const expLines = sections.experience ?? lines;
  const experience = parseExperience(expLines);
  const eduLines = sections.education ?? lines;
  const education = parseEducation(eduLines);
  const certifications = uniq(
    (sections.certifications ?? lines.filter((l) => /\b(certified|certification|certificate)\b/i.test(l)))
      .map((l) => l.replace(/^[•\-*▪◦]\s*/, ''))
      .filter((l) => l.length > 3 && l.length < 160),
  ).slice(0, 15);
  const achievements = uniq(
    (sections.achievements ?? lines.filter((l) => /^[•\-*▪◦]/.test(l) && /\d+\s?%|\b(reduced|increased|improved|saved|cut|grew|delivered|automated)\b/i.test(l)))
      .map((l) => l.replace(/^[•\-*▪◦]\s*/, ''))
      .filter((l) => l.length > 10 && l.length < 260),
  ).slice(0, 12);

  const skills = extractSkills(text);
  const eduText = education.map((e) => e.degree + ' ' + e.institution).join(' ') || text;
  const hasBachelor = /\b(bachelor|bba|b\.?b\.?a|b\.?com|b\.?sc|b\.?tech|b\.?e\b|undergraduate|bs\b|b\.?a\b)/i.test(eduText);
  const hasMaster = /\b(master|mba|m\.?sc|m\.?com|m\.?tech|ms in|pgdm|post ?graduate)/i.test(eduText);
  const degreeFields = uniq(
    ['business analytics', 'business administration', 'commerce', 'economics', 'statistics', 'mathematics', 'computer science', 'engineering', 'finance', 'data science', 'information systems', 'management']
      .filter((f) => eduText.toLowerCase().includes(f)),
  );

  return {
    name,
    email,
    phone,
    headline,
    skills,
    education,
    experience,
    certifications,
    achievements,
    totalYears: totalYears(experience, now),
    industries: skills.filter((s) => DOMAIN_SKILLS.includes(s)),
    hasBachelor,
    hasMaster,
    degreeFields,
    suggestedTitles: suggestTitles(skills),
  };
}
