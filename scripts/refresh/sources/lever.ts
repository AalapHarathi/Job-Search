// Lever Postings API (public, no key): https://github.com/lever/postings-api
import type { BoardRef } from '../../../shared/types';
import { htmlToText } from '../../../shared/text';
import { getJson } from '../http';
import type { BoardFetch, RawJob } from '../types';

interface LvJob {
  id: string; text: string; hostedUrl: string; applyUrl?: string; createdAt?: number; country?: string;
  categories?: { location?: string; commitment?: string; team?: string; allLocations?: string[] };
  workplaceType?: string; descriptionPlain?: string; description?: string;
  lists?: { text: string; content: string }[]; additionalPlain?: string;
  salaryRange?: { min?: number; max?: number; currency?: string; interval?: string };
}

export async function fetchLever(b: BoardRef): Promise<BoardFetch> {
  // Prefix a token with "eu:" for companies hosted on Lever's EU instance.
  const eu = b.token.startsWith('eu:');
  const token = eu ? b.token.slice(3) : b.token;
  const host = eu ? 'https://api.eu.lever.co' : 'https://api.lever.co';
  const r = await getJson<LvJob[]>(`${host}/v0/postings/${encodeURIComponent(token)}?mode=json`);
  if (!r.data) return { board: b.token, source: 'lever', ok: false, jobs: [], error: r.status === 404 ? `Board "${b.token}" not found` : r.error };
  const company = b.name || token;
  const out: RawJob[] = r.data.map((j) => {
    const lists = (j.lists ?? []).map((l) => `${l.text}\n${htmlToText(l.content)}`).join('\n\n');
    const desc = [j.descriptionPlain ?? htmlToText(j.description ?? ''), lists, j.additionalPlain ?? ''].filter(Boolean).join('\n\n');
    const sr = j.salaryRange;
    const wt = j.workplaceType === 'remote' ? 'Remote' : j.workplaceType === 'hybrid' ? 'Hybrid' : j.workplaceType === 'onsite' ? 'On-site' : null;
    return {
      source: 'lever',
      externalId: j.id,
      board: b.token,
      title: j.text.trim(),
      company,
      companyWebsite: b.website,
      applicationUrl: j.applyUrl || j.hostedUrl,
      sourceUrl: j.hostedUrl,
      location: (j.categories?.allLocations?.join('; ') || j.categories?.location || '').trim(),
      countryHint: j.country ?? null,
      employmentType: j.categories?.commitment ?? null,
      workplaceHint: wt,
      salary: sr && (sr.min || sr.max) ? { min: sr.min ?? null, max: sr.max ?? null, currency: sr.currency ?? null, interval: sr.interval ?? null, text: null } : null,
      postedAt: j.createdAt ? new Date(j.createdAt).toISOString() : null,
      postedDateSource: j.createdAt ? 'Lever created date' : null,
      closingDate: null,
      description: desc,
    };
  });
  return { board: b.token, source: 'lever', ok: true, jobs: out, error: null };
}
