export type Freshness = 'Very recent' | 'Recent' | 'Active' | 'Older active' | 'Older' | 'Undated';

export function ageDays(iso: string | null, now = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return null;
  return Math.max(0, Math.floor((now - t) / 86_400_000));
}

export function freshness(iso: string | null, now = Date.now()): Freshness {
  const d = ageDays(iso, now);
  if (d === null) return 'Undated';
  if (d <= 3) return 'Very recent';
  if (d <= 7) return 'Recent';
  if (d <= 14) return 'Active';
  if (d <= 30) return 'Older active';
  return 'Older';
}
