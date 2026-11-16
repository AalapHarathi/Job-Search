import { APPLICATION_STATUSES, type ApplicationStatus } from '@shared/types';

export class ValidationError extends Error {}

export function reqString(v: unknown, field: string, max = 500): string {
  if (typeof v !== 'string' || !v.trim()) throw new ValidationError(`${field} is required.`);
  if (v.length > max) throw new ValidationError(`${field} must be under ${max} characters.`);
  return v.trim();
}
export function optString(v: unknown, field: string, max = 5000): string {
  if (v == null || v === '') return '';
  if (typeof v !== 'string') throw new ValidationError(`${field} is invalid.`);
  if (v.length > max) throw new ValidationError(`${field} must be under ${max} characters.`);
  return v.trim();
}
export function url(v: unknown, field: string): string {
  const s = reqString(v, field, 2000);
  try {
    const u = new URL(s);
    if (u.protocol !== 'https:' && u.protocol !== 'http:') throw new Error();
    return u.toString();
  } catch { throw new ValidationError(`${field} must be a valid http(s) link.`); }
}
export function dateOnly(v: unknown, field: string, required = false): string | null {
  if (v == null || v === '') { if (required) throw new ValidationError(`${field} is required.`); return null; }
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw new ValidationError(`${field} must be a valid date.`);
  return v;
}
export function status(v: unknown): ApplicationStatus {
  if (!APPLICATION_STATUSES.includes(v as ApplicationStatus)) throw new ValidationError('Unknown status.');
  return v as ApplicationStatus;
}
