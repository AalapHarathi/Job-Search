import { norm } from './text';

const INCLUDE = [
  /\banalyst\b/, /\banalytics\b/, /\bbusiness intelligence\b/, /\bbi (developer|analyst|specialist|engineer)\b/,
  /\breporting\b/, /\binsights?\b/, /\bproduct operations\b/, /\bproduct ops\b/, /\bbusiness operations\b/,
  /\bbizops\b/, /\bstrategy (and|&) operations\b/, /\bstrategy associate\b/, /\bdata scientist\b/, /\bmis\b/,
];

// Roles that share the word "analyst" but need a different profession.
const ALWAYS_EXCLUDE = [
  /\b(security|soc|cyber|threat|malware|penetration|vulnerability|fraud investigator)\b/,
  /\b(equity research|investment banking|credit risk|underwriting|actuarial|actuary|quant|trading|trader)\b/,
  /\b(clinical|medical|pharmacovigilance|legal|paralegal|compliance officer)\b/,
  /\b(qa|test|testing|quality assurance) analyst\b/, /\b(help ?desk|it support|service desk|network)\b/,
  /\b(director|vp|vice president|head of|chief|principal|staff|partner)\b/,
  /\b(intern|internship|apprentice)\b/,
];

const DS_ENTRY = /\b(junior|jr|associate|graduate|entry|early career|i)\b/;

export function isRelevantTitle(title: string, extraExcludes: string[] = []): boolean {
  const t = norm(title);
  if (!t) return false;
  if (ALWAYS_EXCLUDE.some((re) => re.test(t))) return false;
  if (extraExcludes.some((x) => x.trim() && t.includes(norm(x)))) return false;
  if (/\bdata scientist\b/.test(t) && !DS_ENTRY.test(t)) return false;
  if (/\bengineer\b/.test(t) && !/\b(bi|analytics) engineer\b/.test(t)) return false;
  if (/\bmanager\b/.test(t) && !/\banalyst\b/.test(t)) return false;
  return INCLUDE.some((re) => re.test(t));
}

/** Seniority words that typically mean more experience than the title alone suggests. */
export function seniorityOf(title: string): 'entry' | 'mid' | 'senior' {
  const t = norm(title);
  if (/\b(senior|sr|lead|ii{1,2}|iii|level 3)\b/.test(t)) return 'senior';
  if (/\b(junior|jr|associate|graduate|entry|trainee)\b/.test(t)) return 'entry';
  return 'mid';
}

export function titleCategory(title: string): string {
  const t = norm(title);
  if (/people analytics|hr analytics|workforce/.test(t)) return 'People Analytics';
  if (/product operations|product ops/.test(t)) return 'Product Operations';
  if (/product/.test(t)) return 'Product Analytics';
  if (/business intelligence|\bbi\b/.test(t)) return 'Business Intelligence';
  if (/reporting|\bmis\b/.test(t)) return 'Reporting';
  if (/data scientist/.test(t)) return 'Data Science';
  if (/strategy/.test(t)) return 'Strategy';
  if (/operations|bizops/.test(t)) return 'Operations';
  if (/consult/.test(t)) return 'Consulting';
  if (/business analyst|business analysis/.test(t)) return 'Business Analysis';
  if (/data|analytics|insight/.test(t)) return 'Data Analysis';
  return 'Other Analyst';
}
