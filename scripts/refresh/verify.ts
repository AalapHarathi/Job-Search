import { http } from './http';

const CLOSED_PATTERNS = [
  /this (job|position|role|vacancy|posting) (is )?(no longer|not) (available|open|accepting)/i,
  /(job|position|vacancy|role) (has been|is) (filled|closed|expired)/i,
  /no longer accepting applications/i,
  /applications? (are|is) (now )?closed/i,
  /this job (has )?expired/i,
  /the job you('| a)re looking for (is no longer|doesn't exist|was not found)/i,
  /posting (has been )?(removed|closed)/i,
];

export interface PageCheck { state: 'open' | 'closed' | 'unknown'; httpStatus: number | null; note: string | null }

/** Fetch the vacancy page and look for hard evidence that it is closed. */
export async function checkPage(url: string): Promise<PageCheck> {
  const r = await http(url, { timeoutMs: 12000, retries: 1, headers: { Accept: 'text/html,*/*;q=0.5' } });
  if (r.status === 0) return { state: 'unknown', httpStatus: null, note: `Page unreachable (${r.error ?? 'network error'})` };
  if (r.status === 404 || r.status === 410) return { state: 'closed', httpStatus: r.status, note: `Listing page returns ${r.status}` };
  if (r.status === 401 || r.status === 403 || r.status === 429) return { state: 'unknown', httpStatus: r.status, note: `Site blocked automated check (${r.status})` };
  if (!r.ok) return { state: 'unknown', httpStatus: r.status, note: `Listing page error ${r.status}` };
  const sample = r.text.slice(0, 200_000);
  if (CLOSED_PATTERNS.some((re) => re.test(sample))) return { state: 'closed', httpStatus: r.status, note: 'Page says the vacancy is closed' };
  // Greenhouse/Lever redirect closed postings to the board root with an error flag.
  if (/[?&]error=true/.test(r.finalUrl)) return { state: 'closed', httpStatus: r.status, note: 'Redirected to board with error (posting removed)' };
  return { state: 'open', httpStatus: r.status, note: null };
}
