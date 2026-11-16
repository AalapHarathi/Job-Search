// Application documents generated only from facts on your resume and in the
// posting. Anything that needs your judgement is left as a [bracketed] prompt.
import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType } from 'docx';
import type { Job, ResumeVersion } from '@shared/types';
import { SPONSORSHIP_LABELS } from '@shared/types';
import { coverLetterText } from './letterText';

function p(text: string, opts: { bold?: boolean; size?: number; spacingAfter?: number; italic?: boolean } = {}) {
  return new Paragraph({ spacing: { after: opts.spacingAfter ?? 160 }, children: [new TextRun({ text, bold: opts.bold, italics: opts.italic, size: opts.size ?? 22, font: 'Calibri' })] });
}

export async function coverLetterDocx(job: Job, resume: ResumeVersion): Promise<Blob> {
  const paras = coverLetterText(job, resume);
  const doc = new Document({
    sections: [{
      children: [
        p(new Date().toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }), { spacingAfter: 320 }),
        ...paras.flatMap((t) => t.split('\n').map((line, i, arr) => p(line, { spacingAfter: i === arr.length - 1 ? 200 : 0 }))),
      ],
    }],
  });
  return Packer.toBlob(doc);
}

/**
 * Tailored resume: a "relevant skills for this role" block (only skills that
 * appear on BOTH your resume and the posting), followed by your original
 * resume text unchanged. No facts are added or reworded.
 */
export async function tailoredResumeDocx(job: Job, resume: ResumeVersion): Promise<Blob> {
  const pr = resume.profile;
  const matched = (job.match?.matchedSkills ?? []).filter((s) => pr.skills.includes(s) || resume.text.toLowerCase().includes(s.toLowerCase()));
  const others = pr.skills.filter((s) => !matched.includes(s));
  const lines = resume.text.split('\n');
  const doc = new Document({
    sections: [{
      children: [
        new Paragraph({ heading: HeadingLevel.HEADING_1, alignment: AlignmentType.LEFT, children: [new TextRun({ text: pr.name ?? resume.name, bold: true, size: 32, font: 'Calibri' })] }),
        p([pr.email, pr.phone].filter(Boolean).join('  |  '), { spacingAfter: 240 }),
        p(`Relevant skills for ${job.title} at ${job.company}`, { bold: true, size: 24 }),
        p(matched.length ? matched.join(' • ') : 'No overlapping skills detected — review the posting before applying.', { spacingAfter: 80 }),
        ...(others.length ? [p(`Additional skills: ${others.join(' • ')}`, { spacingAfter: 280 })] : []),
        p('Resume', { bold: true, size: 24 }),
        ...lines.map((l) => p(l, { spacingAfter: l.trim() ? 40 : 120 })),
      ],
    }],
  });
  return Packer.toBlob(doc);
}

export function sponsorshipLine(job: Job) { return SPONSORSHIP_LABELS[job.sponsorship.category]; }
