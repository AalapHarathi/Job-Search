// Engine self-test: npm run test:engine
// Fixture resume uses only the profile facts stated in the project brief.
import { parseResumeText } from '../shared/resumeParser';
import { scoreJob } from '../shared/matching';
import { classifySponsorship } from '../shared/sponsorship';
import { isRelevantTitle } from '../shared/titles';
import { detectCountry } from '../shared/geo';
import { dedupeKey } from '../shared/dedupe';
import { htmlToText } from '../shared/text';

let failed = 0;
const eq = (name: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) failed++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`}`);
};

const RESUME = `Test Candidate
Business Analyst
test@example.com | +91 90000 00000

PROFESSIONAL EXPERIENCE
Educational Operations & Business Analyst | Empower Consultancy Services LLP
May 2023 – Present
• Built Power BI and Tableau dashboards for KPI reporting
• Gathered requirements from stakeholders and wrote documentation
• Wrote SQL queries in Microsoft Excel and SQL Server for operational analytics
• Drove process improvement and research and insight generation

EDUCATION
BBA in Business Analytics
GITAM University

SKILLS
Business Analysis, Business Intelligence, Excel, Tableau, Power BI, SQL, Data Analysis, Dashboard Development, Stakeholder Management
`;

const now = new Date('2026-11-16T00:00:00Z');
const p = parseResumeText(RESUME, now);
console.log('Parsed:', { name: p.name, years: p.totalYears, skills: p.skills.length, exp: p.experience.map((e) => `${e.title} @ ${e.company} ${e.start}→${e.end}`), edu: p.education.map((e) => e.degree), bachelor: p.hasBachelor, fields: p.degreeFields });
eq('years from May 2023 to Nov 2026', p.totalYears, 3.6);
eq('has bachelor', p.hasBachelor, true);
eq('skills include Power BI + SQL', ['Power BI', 'SQL', 'Tableau'].every((s) => p.skills.includes(s)), true);
eq('experience title', p.experience[0]?.title, 'Educational Operations & Business Analyst');

const resume = { id: 'r1', name: 'Main', text: RESUME, profile: p };

const jdUK = `We're hiring a Business Analyst in London (hybrid). You will gather requirements from stakeholders, build Power BI dashboards, write SQL, and drive process improvement. 2+ years of experience required. Bachelor's degree in a relevant field. Please note we are unable to offer visa sponsorship for this role.`;
const jdAU = `Data Analyst – Sydney. Visa sponsorship is available for the right candidate. Requirements: 3-5 years experience with SQL, Python and Tableau; experience with A/B testing and Looker preferred. Responsibilities include reporting, KPI tracking and presenting insights to stakeholders in the e-commerce domain.`;
const jdIN = `BI Analyst, Hyderabad. Minimum 2 years experience in Power BI, DAX and SQL. Build dashboards and automate MIS reporting for our education business. Graduate degree required.`;

const sUK = classifySponsorship(jdUK, 'GB');
const sAU = classifySponsorship(jdAU, 'AU');
eq('UK refusal → D', sUK.category, 'D');
eq('AU sponsorship → A', sAU.category, 'A');
eq('IN → N', classifySponsorship(jdIN, 'IN').category, 'N');
eq('right to work → E', classifySponsorship('Applicants must have the right to work in the UK.', 'GB').category, 'E');
eq('relocation → B', classifySponsorship('We offer a relocation package and visa support guidance.', 'GB').category, 'B');
eq('silent → C', classifySponsorship('Great team, great snacks.', 'NL').category, 'C');
eq('"do not offer free lunch" is not a refusal', classifySponsorship('We do not offer free lunch. Visa sponsorship is available.', 'GB').category, 'A');

const job = (title: string, desc: string, country: string, sp: ReturnType<typeof classifySponsorship>) => ({ title, company: 'X', description: desc, country, workArrangement: 'Hybrid' as const, sponsorship: sp });
const mUK = scoreJob(job('Business Analyst', jdUK, 'GB', sUK), resume, { now });
const mAU = scoreJob(job('Data Analyst', jdAU, 'AU', sAU), resume, { now });
const mIN = scoreJob(job('BI Analyst', jdIN, 'IN', classifySponsorship(jdIN, 'IN')), resume, { now });
for (const [n, m] of [['UK BA', mUK], ['AU DA', mAU], ['IN BI', mIN]] as const) {
  console.log(`\n${n}: ${m.score} (${m.label})`, m.components, '\n  missing:', m.missingSkills.join(', '), '\n  verdict:', m.analysis.worthIt, '\n  recs:', m.analysis.recommendations);
}
eq('UK verdict Skip because of sponsorship', mUK.analysis.worthIt.verdict, 'Skip');
eq('UK location points 0', mUK.components.location, 0);
eq('AU missing Python', mAU.missingSkills.includes('Python'), true);
eq('IN scores higher than AU', mIN.score > mAU.score, true);
eq('score is sum of parts', mIN.score, Math.round(Object.values(mIN.components).reduce((a, b) => a + b, 0)));

eq('title: Business Analyst', isRelevantTitle('Business Analyst'), true);
eq('title: Senior Data Scientist excluded', isRelevantTitle('Senior Data Scientist'), false);
eq('title: Junior Data Scientist', isRelevantTitle('Junior Data Scientist'), true);
eq('title: Security Analyst excluded', isRelevantTitle('Security Operations Analyst'), false);
eq('title: Software Engineer excluded', isRelevantTitle('Software Engineer'), false);
eq('title: Analytics Engineer kept', isRelevantTitle('Analytics Engineer'), true);
eq('title: Head of Analytics excluded', isRelevantTitle('Head of Analytics'), false);
eq('country London', detectCountry('London, UK'), 'GB');
eq('country Austin TX', detectCountry('Austin, TX'), 'US');
eq('country Bengaluru', detectCountry('Bengaluru, Karnataka'), 'IN');
eq('country Remote', detectCountry('Remote'), null);
eq('dedupe across sources', dedupeKey('Stripe, Inc.', 'Data Analyst (Hybrid)', 'London, UK', 'GB'), dedupeKey('Stripe', 'Data Analyst', 'London', 'GB'));
eq('html to text', htmlToText('&lt;p&gt;Hello &amp;amp; welcome&lt;/p&gt;&lt;ul&gt;&lt;li&gt;SQL&lt;/li&gt;&lt;/ul&gt;'), 'Hello & welcome\n\n• SQL');

console.log(`\n${failed ? `${failed} FAILED` : 'All checks passed'}`);
process.exitCode = failed ? 1 : 0;
