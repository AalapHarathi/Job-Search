import type { Salary, SourceId } from '../../shared/types';

export interface RawJob {
  source: SourceId;
  externalId: string;
  board: string | null;
  title: string;
  company: string;
  companyWebsite: string | null;
  applicationUrl: string | null; // employer/ATS page; null for aggregator-only listings
  sourceUrl: string;
  location: string;
  countryHint: string | null;
  employmentType: string | null;
  workplaceHint: string | null;
  salary: Salary | null;
  postedAt: string | null;
  postedDateSource: string | null;
  closingDate: string | null;
  description: string;
}

export interface SourceReport { ok: boolean; fetched: number; errors: string[] }

export interface BoardFetch { board: string; source: SourceId; ok: boolean; jobs: RawJob[]; error: string | null }
