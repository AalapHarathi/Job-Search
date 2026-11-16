import type { Salary } from '@shared/types';
import { ageDays } from '@shared/freshness';

export function relDays(iso: string | null | undefined): string {
  const d = ageDays(iso ?? null);
  if (d === null) return '—';
  if (d === 0) return 'Today';
  if (d === 1) return 'Yesterday';
  if (d < 30) return `${d}d ago`;
  if (d < 365) return `${Math.floor(d / 30)}mo ago`;
  return `${Math.floor(d / 365)}y ago`;
}

export function fmtDate(iso: string | null | undefined, withTime = false): string {
  if (!iso) return '—';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleString(undefined, withTime
    ? { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }
    : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function fmtDateTimeRel(iso: string | null | undefined): string {
  if (!iso) return 'Never';
  const ms = Date.now() - Date.parse(iso);
  const future = ms < 0;
  const m = Math.round(Math.abs(ms) / 60000);
  const span = m < 1 ? 'just now' : m < 60 ? `${m} min` : m < 1440 ? `${Math.round(m / 60)} h` : `${Math.round(m / 1440)} d`;
  if (span === 'just now') return span;
  return future ? `in ${span}` : `${span} ago`;
}

const SYMBOL: Record<string, string> = { GBP: '£', USD: '$', AUD: 'A$', EUR: '€', INR: '₹', CAD: 'C$', SGD: 'S$', NZD: 'NZ$' };

export function fmtSalary(s: Salary | null): string {
  if (!s) return '—';
  if (s.text && !s.min && !s.max) return s.text;
  if (!s.min && !s.max) return '—';
  const sym = s.currency ? SYMBOL[s.currency] ?? `${s.currency} ` : '';
  const k = (n: number) => (n >= 100000 && s.currency === 'INR' ? `${(n / 100000).toFixed(1).replace(/\.0$/, '')}L` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n));
  const range = s.min && s.max && s.min !== s.max ? `${sym}${k(s.min)}–${k(s.max)}` : `${sym}${k((s.min ?? s.max)!)}`;
  const iv = (s.interval || '').toLowerCase();
  const per = /year|annual|yr/.test(iv) ? ' /yr' : /month/.test(iv) ? ' /mo' : /hour/.test(iv) ? ' /hr' : /day/.test(iv) ? ' /day' : '';
  return range + per;
}

export function todayIso(): string {
  const d = new Date();
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

export function daysUntil(dateIso: string | null | undefined): number | null {
  if (!dateIso) return null;
  const t = Date.parse(dateIso.length === 10 ? dateIso + 'T23:59:59' : dateIso);
  if (Number.isNaN(t)) return null;
  return Math.ceil((t - Date.now()) / 86_400_000);
}

export function pct(n: number, d: number): string {
  if (!d) return '—';
  return `${Math.round((n / d) * 100)}%`;
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function safeUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try { const x = new URL(u); return x.protocol === 'https:' || x.protocol === 'http:' ? x.toString() : null; }
  catch { return null; }
}
