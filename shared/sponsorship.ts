import type { SponsorshipCategory } from './types';

// Order matters: explicit refusals beat generic positive phrases
// ("we are unable to offer visa sponsorship" contains "visa sponsorship").
const NOT_AVAILABLE = [
  /\b(unable|not able|cannot|can ?not|can't|won't|will not|do not|don't|does not|doesn't|are not able)\s+(to\s+)?(offer|provide|support|sponsor)\w*\b[^.]{0,40}\b(visa|work permit|sponsorship|immigration)/i,
  /\b(cannot|can't|unable to|do not|don't|will not|won't|not able to|are not able to)\s+sponsor\b/i,
  /\bno\s+(visa\s+)?sponsorship\b/i,
  /\bsponsorship\s+(is\s+)?(not|unavailable|not available|not offered|not provided)\b/i,
  /\bnot\s+(in a position to\s+)?sponsor\b/i,
  /\bwithout\s+(the\s+)?(need|requirement)\s+(for|of)\s+(current\s+or\s+future\s+)?(visa\s+)?sponsorship\b/i,
  /\bnow or in the future require sponsorship\b/i,
];
const AUTH_REQUIRED = [
  /\bmust\s+(already\s+)?(have|hold|possess)\s+(the\s+)?(full\s+)?(right|legal right|authori[sz]ation|eligibility)\s+to\s+work\b/i,
  /\b(must|should)\s+be\s+(legally\s+)?(authori[sz]ed|eligible|entitled)\s+to\s+work\b/i,
  /\b(existing|current|valid)\s+(right|authori[sz]ation|permit)\s+to\s+work\b/i,
  /\bright to work in (the )?(uk|united kingdom|australia|us|united states|ireland|germany|netherlands|eu)\b/i,
  /\b(citizens?|permanent residents?)\s+only\b/i,
  /\b(must be|open only to|restricted to)\s+(an?\s+)?(australian|us|u\.s\.|uk|british|irish|eu)?\s*(citizen|permanent resident|national)s?\b/i,
  /\b(security clearance|sc clearance|dv clearance|baseline clearance|nv1|nv2)\b/i,
];
const CONFIRMED = [
  /\b(visa\s+sponsorship|sponsorship)\s+(is\s+)?(available|offered|provided)\b/i,
  /\bwe\s+(will|can|do|are able to|are happy to)\s+(offer\s+|provide\s+)?sponsor\w*\b/i,
  /\b(skilled worker|482|tss|h-?1b|blue card)\s+(visa\s+)?sponsorship\s+(available|offered|provided)\b/i,
  /\bsponsorship\s+for\s+(this|the)\s+(role|position)\b(?![^.]*\bnot\b)/i,
  /\bvisa\s+support\s+(is\s+)?(available|provided|offered)\b/i,
];
const POSSIBLE = [
  /\brelocation\s+(support|assistance|package|budget)\b/i,
  /\b(visa|immigration)\s+(support|assistance|guidance)\b/i,
  /\bsponsorship\s+(may|might|could)\s+be\b/i,
  /\bcase[- ]by[- ]case\b[^.]{0,60}\bsponsor/i,
  /\bopen to (international|candidates (who )?(require|need))/i,
  /\blicen[cs]ed\s+(visa\s+)?sponsor\b/i,
];

function firstMatch(text: string, pats: RegExp[]): string | null {
  for (const re of pats) {
    const m = re.exec(text);
    if (m) {
      const start = Math.max(0, m.index - 60);
      const end = Math.min(text.length, m.index + m[0].length + 80);
      return text.slice(start, end).replace(/\s+/g, ' ').trim();
    }
  }
  return null;
}

/** Classify sponsorship from the vacancy text. India-based roles don't need sponsorship for this user. */
export function classifySponsorship(description: string, country: string | null, homeCountry = 'IN'): { category: SponsorshipCategory; evidence: string | null } {
  if (country === homeCountry) return { category: 'N', evidence: null };
  const text = description || '';
  let ev = firstMatch(text, NOT_AVAILABLE);
  if (ev) return { category: 'D', evidence: ev };
  ev = firstMatch(text, AUTH_REQUIRED);
  if (ev) return { category: 'E', evidence: ev };
  ev = firstMatch(text, CONFIRMED);
  if (ev) return { category: 'A', evidence: ev };
  ev = firstMatch(text, POSSIBLE);
  if (ev) return { category: 'B', evidence: ev };
  return { category: 'C', evidence: null };
}

export function sponsorshipBlocksRelocation(cat: SponsorshipCategory): boolean {
  return cat === 'D' || cat === 'E';
}

export const SPONSORSHIP_RANK: Record<SponsorshipCategory, number> = { N: 0, A: 1, B: 2, C: 3, E: 4, D: 5 };
