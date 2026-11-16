import type { WorkArrangement } from './types';

export const COUNTRY_NAMES: Record<string, string> = {
  GB: 'United Kingdom', AU: 'Australia', IN: 'India', US: 'United States', DE: 'Germany',
  NL: 'Netherlands', IE: 'Ireland', CA: 'Canada', SG: 'Singapore', NZ: 'New Zealand', AE: 'United Arab Emirates',
};

// Ordered: more specific first. Patterns run against the raw location string.
const COUNTRY_PATTERNS: [string, RegExp][] = [
  ['IN', /\b(india|bengaluru|bangalore|hyderabad|mumbai|pune|chennai|new delhi|delhi|gurgaon|gurugram|noida|kolkata|ahmedabad|jaipur|kochi|coimbatore|visakhapatnam|indore|chandigarh)\b/i],
  ['GB', /\b(united kingdom|uk|england|scotland|wales|northern ireland|london|manchester|birmingham|leeds|bristol|edinburgh|glasgow|cardiff|belfast|liverpool|newcastle|sheffield|nottingham|cambridge|oxford|reading|brighton|milton keynes)\b/i],
  ['IE', /\b(ireland|dublin|cork|galway|limerick)\b/i],
  ['AU', /\b(australia|sydney|melbourne|brisbane|perth|adelaide|canberra|hobart|gold coast|nsw|vic|qld)\b/i],
  ['NZ', /\b(new zealand|auckland|wellington|christchurch)\b/i],
  ['DE', /\b(germany|deutschland|berlin|munich|münchen|hamburg|frankfurt|cologne|köln|stuttgart|düsseldorf|dusseldorf|leipzig)\b/i],
  ['NL', /\b(netherlands|holland|amsterdam|rotterdam|utrecht|the hague|den haag|eindhoven)\b/i],
  ['CA', /\b(canada|toronto|vancouver|montreal|montréal|calgary|ottawa|waterloo|ontario|british columbia|quebec)\b/i],
  ['SG', /\bsingapore\b/i],
  ['AE', /\b(united arab emirates|uae|dubai|abu dhabi)\b/i],
  ['US', /\b(united states|usa|u\.s\.|us|new york|nyc|san francisco|sf bay|seattle|austin|chicago|boston|los angeles|denver|atlanta|miami|dallas|houston|washington,? dc|palo alto|mountain view|menlo park|sunnyvale|san jose|portland|philadelphia|pittsburgh|minneapolis|salt lake|phoenix|raleigh|nashville)\b/i],
  ['US', /,\s*(AL|AK|AZ|AR|CA|CO|CT|DE|FL|GA|HI|ID|IL|IN|IA|KS|KY|LA|ME|MD|MA|MI|MN|MS|MO|MT|NE|NV|NH|NJ|NM|NY|NC|ND|OH|OK|OR|PA|RI|SC|SD|TN|TX|UT|VT|VA|WA|WV|WI|WY)\b/],
];

const ISO_ALIASES: Record<string, string> = {
  'united kingdom': 'GB', uk: 'GB', gb: 'GB', gbr: 'GB', 'great britain': 'GB',
  'united states': 'US', usa: 'US', us: 'US', 'united states of america': 'US',
  australia: 'AU', au: 'AU', aus: 'AU', india: 'IN', in: 'IN', ind: 'IN',
  germany: 'DE', de: 'DE', deu: 'DE', netherlands: 'NL', nl: 'NL', nld: 'NL',
  ireland: 'IE', ie: 'IE', irl: 'IE', canada: 'CA', ca: 'CA', can: 'CA', singapore: 'SG', sg: 'SG', sgp: 'SG',
};

export function countryFromHint(hint: string | null | undefined): string | null {
  if (!hint) return null;
  return ISO_ALIASES[hint.trim().toLowerCase()] ?? null;
}

export function detectCountry(location: string, hint?: string | null): string | null {
  const fromHint = countryFromHint(hint);
  if (fromHint) return fromHint;
  for (const [code, re] of COUNTRY_PATTERNS) if (re.test(location)) return code;
  return null;
}

export function detectArrangement(...texts: (string | null | undefined)[]): WorkArrangement {
  const t = texts.filter(Boolean).join(' ').toLowerCase();
  if (/\bhybrid\b/.test(t)) return 'Hybrid';
  if (/\b(fully remote|remote[- ]first|100% remote|work from home|wfh|remote)\b/.test(t)) return 'Remote';
  if (/\b(on[- ]?site|in[- ]office|onsite|office[- ]based)\b/.test(t)) return 'On-site';
  return 'Unknown';
}
