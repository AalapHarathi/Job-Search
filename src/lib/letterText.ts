import type { Job, ResumeVersion } from '@shared/types';
import { detectThemes } from '@shared/skills';

export function coverLetterText(job: Job, resume: ResumeVersion): string[] {
  const pr = resume.profile;
  const latest = pr.experience.find((e) => !e.end) ?? pr.experience[0];
  const matched = job.match?.matchedSkills ?? [];
  const shared = detectThemes(job.description).filter((t) => detectThemes(resume.text).includes(t));
  const edu = pr.education[0];
  const years = pr.totalYears;
  const needsVisa = job.sponsorship.category !== 'N';

  const paras: string[] = [];
  paras.push(`Dear Hiring Team at ${job.company},`);
  paras.push(`I am applying for the ${job.title} role${job.location ? ` (${job.location})` : ''}. ${latest ? `I currently work as ${latest.title || 'an analyst'}${latest.company ? ` at ${latest.company}` : ''}` : 'I work as an analyst'}${years ? `, with about ${years} years of professional experience` : ''}${edu ? `, and I hold a ${edu.degree}${edu.institution && !edu.degree.includes(edu.institution) ? ` from ${edu.institution}` : ''}` : ''}.`);
  if (matched.length) paras.push(`Your posting asks for ${matched.slice(0, 5).join(', ')} — all of which I use in my current work. [Add one specific example from your resume that shows the most important of these in action, with its result.]`);
  if (shared.length) paras.push(`The responsibilities you describe — ${shared.slice(0, 3).map((s) => s.toLowerCase()).join('; ')} — closely match what I do day to day. [Name the stakeholders, reports or processes you handled.]`);
  paras.push(`[One or two sentences on why ${job.company} specifically — its product, customers or mission.]`);
  if (needsVisa) paras.push(`I am based in India and would require visa sponsorship to relocate${job.sponsorship.category === 'A' ? ', which I understand you offer for this role' : ''}. I am glad to discuss timelines and logistics.`);
  paras.push('Thank you for your time and consideration. I would welcome the chance to discuss how I can contribute to your team.');
  paras.push(`Kind regards,\n${pr.name ?? '[Your name]'}${pr.email ? `\n${pr.email}` : ''}${pr.phone ? `\n${pr.phone}` : ''}`);
  return paras;
}

