// Greenhouse Job Board API (public, no key): https://developers.greenhouse.io/job-board.html
import type { BoardRef } from '../../../shared/types';
import { htmlToText } from '../../../shared/text';
import { getJson } from '../http';
import type { BoardFetch, RawJob } from '../types';

interface GhJob {
  id: number; title: string; absolute_url: string; updated_at?: string; first_published?: string;
  location?: { name?: string }; content?: string; metadata?: { name: string; value: unknown }[] | null;
}

export async function fetchGreenhouse(b: BoardRef): Promise<BoardFetch> {
  const base = `https://boards-api.greenhouse.io/v1/boards/${encodeURIComponent(b.token)}`;
  const [jobs, board] = await Promise.all([
    getJson<{ jobs: GhJob[] }>(`${base}/jobs?content=true`),
    b.name ? Promise.resolve({ data: { name: b.name }, error: null, status: 200 }) : getJson<{ name: string }>(base),
  ]);
  if (!jobs.data) return { board: b.token, source: 'greenhouse', ok: false, jobs: [], error: jobs.status === 404 ? `Board "${b.token}" not found` : jobs.error };
  const company = b.name || board.data?.name || b.token;
  const out: RawJob[] = jobs.data.jobs.map((j) => {
    const desc = htmlToText(j.content ?? '');
    const empType = (j.metadata ?? []).find((m) => /employment|job type|contract/i.test(m.name));
    return {
      source: 'greenhouse',
      externalId: String(j.id),
      board: b.token,
      title: j.title.trim(),
      company,
      companyWebsite: b.website,
      applicationUrl: j.absolute_url,
      sourceUrl: j.absolute_url,
      location: j.location?.name?.trim() || '',
      countryHint: null,
      employmentType: typeof empType?.value === 'string' ? empType.value : null,
      workplaceHint: j.location?.name ?? null,
      salary: null,
      // Only first_published is a true posting date; updated_at is not used as one.
      postedAt: j.first_published ?? null,
      postedDateSource: j.first_published ? 'Greenhouse first published' : null,
      closingDate: null,
      description: desc,
    };
  });
  return { board: b.token, source: 'greenhouse', ok: true, jobs: out, error: null };
}
