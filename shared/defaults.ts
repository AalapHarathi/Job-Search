import type { Preferences } from './types';

export const DEFAULT_TARGET_TITLES = [
  'Business Analyst', 'Data Analyst', 'Business Intelligence Analyst', 'Reporting Analyst', 'Product Analyst',
  'Strategy Analyst', 'Operations Analyst', 'People Analytics Analyst', 'Business Operations Analyst',
  'Analytics Consultant', 'Junior Data Scientist', 'Product Operations Analyst',
];

// Starter boards. These are public Job Board API identifiers; the refresh job
// reports any that return "not found" so you can correct or remove them.
// Add employers you care about (especially UK/AU sponsors) from Search Preferences.
export const STARTER_BOARDS: Preferences['boards'] = [
  { source: 'greenhouse', token: 'stripe', name: 'Stripe', website: 'https://stripe.com' },
  { source: 'greenhouse', token: 'airbnb', name: 'Airbnb', website: 'https://www.airbnb.com' },
  { source: 'greenhouse', token: 'databricks', name: 'Databricks', website: 'https://www.databricks.com' },
  { source: 'greenhouse', token: 'cloudflare', name: 'Cloudflare', website: 'https://www.cloudflare.com' },
  { source: 'greenhouse', token: 'gitlab', name: 'GitLab', website: 'https://about.gitlab.com' },
  { source: 'greenhouse', token: 'figma', name: 'Figma', website: 'https://www.figma.com' },
  { source: 'lever', token: 'palantir', name: 'Palantir', website: 'https://www.palantir.com' },
  { source: 'lever', token: 'spotify', name: 'Spotify', website: 'https://www.spotify.com' },
  { source: 'ashby', token: 'notion', name: 'Notion', website: 'https://www.notion.so' },
  { source: 'ashby', token: 'ramp', name: 'Ramp', website: 'https://ramp.com' },
];

export function defaultPreferences(): Preferences {
  return {
    countries: [
      { code: 'GB', name: 'United Kingdom', priority: 1, enabled: true },
      { code: 'AU', name: 'Australia', priority: 1, enabled: true },
      { code: 'IN', name: 'India', priority: 2, enabled: true },
      { code: 'US', name: 'United States', priority: 3, enabled: true },
      { code: 'DE', name: 'Germany', priority: 3, enabled: true },
      { code: 'NL', name: 'Netherlands', priority: 3, enabled: true },
      { code: 'IE', name: 'Ireland', priority: 3, enabled: true },
      { code: 'CA', name: 'Canada', priority: 3, enabled: false },
      { code: 'SG', name: 'Singapore', priority: 3, enabled: false },
    ],
    targetTitles: DEFAULT_TARGET_TITLES,
    excludeTitleKeywords: [],
    includeOlder: false,
    includeUndated: true,
    requiresSponsorship: true,
    minRecommendedScore: 70,
    boards: STARTER_BOARDS,
    aggregators: { adzuna: true, reed: true },
    maxQueriesPerSource: 24,
    notifications: {
      newExcellent: true,
      excellentThreshold: 85,
      closingSoon: true,
      savedUnavailable: true,
      followUps: true,
      interviews: true,
      statusChanges: true,
      previouslyAppliedCompanies: true,
    },
    updatedAt: new Date(0).toISOString(),
  };
}

/** Merge stored prefs over defaults so new fields added later always exist. */
export function withDefaults(p: Partial<Preferences> | undefined | null): Preferences {
  const d = defaultPreferences();
  if (!p) return d;
  return {
    ...d,
    ...p,
    aggregators: { ...d.aggregators, ...(p.aggregators ?? {}) },
    notifications: { ...d.notifications, ...(p.notifications ?? {}) },
    countries: p.countries?.length ? p.countries : d.countries,
    boards: p.boards ?? d.boards,
    targetTitles: p.targetTitles?.length ? p.targetTitles : d.targetTitles,
  };
}
