// Optional LLM enrichment. Runs only server-side; the key never reaches the browser.
import type { MatchAnalysis, ResumeProfile } from '../../shared/types';

const PROVIDER = (process.env.LLM_PROVIDER || 'anthropic').toLowerCase();
const KEY = process.env.LLM_API_KEY || '';
const MODEL = process.env.LLM_MODEL || (PROVIDER === 'anthropic' ? 'claude-haiku-5-5' : 'gpt-4o-mini');
const BASE = process.env.LLM_BASE_URL || 'https://api.openai.com/v1';

export const llmEnabled = () => !!KEY;
export const llmModel = () => MODEL;

async function complete(system: string, user: string): Promise<string> {
  if (PROVIDER === 'anthropic') {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: MODEL, max_tokens: 1500, system, messages: [{ role: 'user', content: user }] }),
    });
    if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
    const data = (await res.json()) as { content: { type: string; text?: string }[] };
    return data.content.filter((c) => c.type === 'text').map((c) => c.text).join('');
  }
  const res = await fetch(`${BASE.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', authorization: `Bearer ${KEY}` },
    body: JSON.stringify({ model: MODEL, temperature: 0.2, messages: [{ role: 'system', content: system }, { role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`LLM HTTP ${res.status}: ${(await res.text()).slice(0, 200)}`);
  const data = (await res.json()) as { choices: { message: { content: string } }[] };
  return data.choices[0]?.message?.content ?? '';
}

function parseJson<T>(s: string): T {
  const cleaned = s.replace(/```json|```/g, '').trim();
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  return JSON.parse(cleaned.slice(start, end + 1)) as T;
}

const GROUNDING = 'Use ONLY facts present in the provided resume and job posting. Never invent qualifications, employers, dates, metrics, certifications or sponsorship policies. If something is not stated, say it is not stated. Respond with JSON only, no markdown.';

export async function aiJobAnalysis(input: { resumeText: string; jobTitle: string; company: string; description: string; sponsorshipLabel: string; score: number }): Promise<MatchAnalysis> {
  const system = `You are a precise career advisor reviewing one job for one candidate. ${GROUNDING}`;
  const user = `CANDIDATE RESUME:\n${input.resumeText.slice(0, 12000)}\n\nJOB: ${input.jobTitle} at ${input.company}\nSponsorship classification (from posting text): ${input.sponsorshipLabel}\nRules-based match score: ${input.score}/100\n\nPOSTING:\n${input.description.slice(0, 12000)}\n\nReturn JSON with exactly these keys:\n{"suitability": string (2-3 sentences), "matches": string[] (max 6), "missingSkills": string[], "experienceGaps": string[], "rejectionRisks": string[], "sponsorship": string, "worthIt": {"verdict": "Apply"|"Consider"|"Skip", "reason": string}, "recommendations": string[] (exactly 3, specific to this posting, no fabricated achievements)}`;
  const out = parseJson<MatchAnalysis>(await complete(system, user));
  if (!out.suitability || !Array.isArray(out.recommendations)) throw new Error('LLM returned an unexpected shape');
  out.recommendations = out.recommendations.slice(0, 3);
  return out;
}

export async function aiResumeProfile(text: string, parsed: ResumeProfile): Promise<{ summary: string; strengths: string[]; suggestedTitles: string[] }> {
  const system = `You summarise resumes for a private job-search dashboard. ${GROUNDING}`;
  const user = `RESUME TEXT:\n${text.slice(0, 15000)}\n\nSkills detected by a parser: ${parsed.skills.join(', ')}\n\nReturn JSON: {"summary": string (3-4 sentence professional profile in third person, facts only), "strengths": string[] (max 6, each traceable to the resume), "suggestedTitles": string[] (max 10 realistic job titles this resume supports, including equivalents)}`;
  return parseJson(await complete(system, user));
}
