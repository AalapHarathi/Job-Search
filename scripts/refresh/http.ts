// Polite HTTP client: per-host spacing, timeouts, limited retries on 429/5xx.
const UA = 'CareerIntelPersonalTracker/1.0 (personal job tracker; respects robots and rate limits)';
const lastHit = new Map<string, number>();
const MIN_GAP_MS = 350;

async function spacing(url: string) {
  const host = new URL(url).host;
  const prev = lastHit.get(host) ?? 0;
  const wait = prev + MIN_GAP_MS - Date.now();
  if (wait > 0) await new Promise((r) => setTimeout(r, wait));
  lastHit.set(host, Date.now());
}

export interface HttpResult { ok: boolean; status: number; text: string; finalUrl: string; error?: string }

export async function http(url: string, init: RequestInit & { timeoutMs?: number; retries?: number } = {}): Promise<HttpResult> {
  const { timeoutMs = 15000, retries = 2, ...rest } = init;
  let attempt = 0;
  for (;;) {
    await spacing(url);
    const ctl = new AbortController();
    const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        ...rest,
        headers: { 'User-Agent': UA, Accept: 'application/json, text/html;q=0.9, */*;q=0.5', ...(rest.headers ?? {}) },
        signal: ctl.signal,
      });
      const text = await res.text();
      clearTimeout(t);
      if ((res.status === 429 || res.status >= 500) && attempt < retries) {
        attempt++;
        const ra = Number(res.headers.get('retry-after'));
        await new Promise((r) => setTimeout(r, (Number.isFinite(ra) && ra > 0 ? ra * 1000 : 1500 * attempt)));
        continue;
      }
      return { ok: res.ok, status: res.status, text, finalUrl: res.url };
    } catch (e) {
      clearTimeout(t);
      if (attempt < retries) { attempt++; await new Promise((r) => setTimeout(r, 1200 * attempt)); continue; }
      return { ok: false, status: 0, text: '', finalUrl: url, error: (e as Error).message };
    }
  }
}

export async function getJson<T>(url: string, init?: RequestInit & { timeoutMs?: number }): Promise<{ data: T | null; status: number; error: string | null }> {
  const r = await http(url, init);
  if (!r.ok) return { data: null, status: r.status, error: r.error ?? `HTTP ${r.status}` };
  try { return { data: JSON.parse(r.text) as T, status: r.status, error: null }; }
  catch { return { data: null, status: r.status, error: 'Invalid JSON' }; }
}

export async function pool<T, R>(items: T[], size: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(size, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k]); }
  }));
  return out;
}
