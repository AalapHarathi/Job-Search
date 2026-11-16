import { hash, norm } from './text';

const COMPANY_SUFFIX = /\b(inc|incorporated|ltd|limited|llc|llp|plc|gmbh|bv|b v|pty|pvt|private|corp|corporation|co|company|group|holdings|technologies|technology|solutions|services|uk|india|australia)\b/g;

export function normCompany(c: string): string {
  return norm(c).replace(COMPANY_SUFFIX, ' ').replace(/\s+/g, ' ').trim();
}

export function normTitle(t: string): string {
  return norm(t)
    .replace(/\b(sr)\b/g, 'senior')
    .replace(/\b(jr)\b/g, 'junior')
    .replace(/\b(m f d|f m d|m w d|all genders)\b/g, ' ')
    .replace(/\b(remote|hybrid|contract|permanent|full time|part time|fixed term|ftc|\d+ months?)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normCity(location: string): string {
  const first = (location || '').split(/[,;|/(]/)[0];
  return norm(first).replace(/\b(remote|hybrid|greater|area|metropolitan|city of)\b/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Same company + same normalised title + same city/country => same vacancy, regardless of source. */
export function dedupeKey(company: string, title: string, location: string, country: string | null): string {
  return [normCompany(company), normTitle(title), normCity(location) || 'any', country || 'xx'].join('|');
}

export function jobIdFromKey(key: string): string {
  return 'j_' + hash(key);
}
