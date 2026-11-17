// Shared domain model. Used by the React app and the server-side refresh job.
// All dates are ISO-8601 strings so they round-trip identically through the
// client SDK, the Admin SDK and Security Rules validation.

export type AtsSource = 'greenhouse' | 'lever' | 'ashby' | 'smartrecruiters' | 'workable' | 'recruitee';
export type SourceId = AtsSource | 'adzuna' | 'reed';
export const ATS_SOURCES: SourceId[] = ['greenhouse', 'lever', 'ashby', 'smartrecruiters', 'workable', 'recruitee'];
export const SOURCE_LABELS: Record<SourceId, string> = {
  greenhouse: 'Greenhouse',
  lever: 'Lever',
  ashby: 'Ashby',
  smartrecruiters: 'SmartRecruiters',
  workable: 'Workable',
  recruitee: 'Recruitee',
  adzuna: 'Adzuna',
  reed: 'Reed',
};

export type SponsorshipCategory = 'A' | 'B' | 'C' | 'D' | 'E' | 'N';
export const SPONSORSHIP_LABELS: Record<SponsorshipCategory, string> = {
  A: 'Sponsorship confirmed',
  B: 'Sponsorship possible',
  C: 'Sponsorship not mentioned',
  D: 'No sponsorship',
  E: 'Local work authorization required',
  N: 'Not required (India)',
};

export type VerificationStatus = 'Verified' | 'Unverified' | 'Closed';

export const APPLICATION_STATUSES = [
  'Discovered',
  'Shortlisted',
  'Saved',
  'Ready to Apply',
  'Applied',
  'Assessment',
  'Interview Scheduled',
  'Interview Completed',
  'Offer Received',
  'Rejected',
  'Withdrawn',
  'Not Interested',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const SUBMITTED_STATUSES: ApplicationStatus[] = [
  'Applied', 'Assessment', 'Interview Scheduled', 'Interview Completed', 'Offer Received', 'Rejected', 'Withdrawn',
];
export const INTERVIEW_STATUSES: ApplicationStatus[] = ['Interview Scheduled', 'Interview Completed', 'Offer Received'];
export const PENDING_STATUSES: ApplicationStatus[] = ['Applied', 'Assessment', 'Interview Scheduled', 'Interview Completed'];

export type WorkArrangement = 'Remote' | 'Hybrid' | 'On-site' | 'Unknown';

export interface JobSourceRef {
  source: SourceId;
  sourceUrl: string;
  externalId: string;
  board: string | null;
  lastSeenAt: string;
}

export interface Salary {
  min: number | null;
  max: number | null;
  currency: string | null;
  interval: string | null;
  text: string | null;
}

export interface MatchComponents {
  skills: number; // /30
  experience: number; // /25
  responsibilities: number; // /20
  education: number; // /10
  industry: number; // /10
  location: number; // /5
}

export const MATCH_WEIGHTS: MatchComponents = {
  skills: 30, experience: 25, responsibilities: 20, education: 10, industry: 10, location: 5,
};

export type MatchLabel = 'Excellent' | 'Strong' | 'Good' | 'Moderate' | 'Low';

export interface MatchAnalysis {
  suitability: string;
  matches: string[];
  missingSkills: string[];
  experienceGaps: string[];
  rejectionRisks: string[];
  sponsorship: string;
  worthIt: { verdict: 'Apply' | 'Consider' | 'Skip'; reason: string };
  recommendations: string[];
}

export interface MatchResult {
  score: number;
  label: MatchLabel;
  components: MatchComponents;
  notes: Partial<Record<keyof MatchComponents, string>>;
  matchedSkills: string[];
  missingSkills: string[];
  requiredYears: number | null;
  candidateYears: number | null;
  analysis: MatchAnalysis;
  aiAnalysis: (MatchAnalysis & { model: string; generatedAt: string }) | null;
  resumeVersionId: string | null;
  perVersion: Record<string, number>;
  computedAt: string;
  engine: string;
}

export interface Job {
  id: string;
  dedupeKey: string;
  title: string;
  company: string;
  companyWebsite: string | null;
  applicationUrl: string | null; // employer / ATS page only — never an aggregator
  sourceUrl: string; // where it was discovered
  primarySource: SourceId;
  sources: JobSourceRef[];
  location: string;
  country: string | null;
  employmentType: string | null;
  workArrangement: WorkArrangement;
  salary: Salary | null;
  postedAt: string | null;
  postedDateSource: string | null;
  closingDate: string | null;
  description: string;
  requiredSkills: string[];
  experienceRequired: string | null;
  educationRequired: string | null;
  sponsorship: { category: SponsorshipCategory; evidence: string | null };
  verification: {
    status: VerificationStatus;
    checkedAt: string;
    method: string;
    note: string | null;
    httpStatus: number | null;
  };
  lastVerifiedAt: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  closedAt: string | null;
  active: boolean;
  // user-owned fields (never written by the refresh job after creation)
  status: ApplicationStatus;
  statusUpdatedAt: string;
  match: MatchResult | null;
}

export interface Application {
  jobId: string;
  company: string;
  title: string;
  applicationUrl: string;
  appliedDate: string;
  resumeVersionId: string | null;
  resumeVersionName: string | null;
  notes: string;
  referral: string;
  nextFollowUp: string | null;
  interviewDate: string | null;
  country: string | null;
  matchScore: number | null;
  createdAt: string;
  updatedAt: string;
  history: { status: ApplicationStatus; at: string; note: string | null }[];
}

export interface ExperienceEntry {
  title: string;
  company: string;
  start: string | null; // YYYY-MM
  end: string | null; // YYYY-MM or null = present
  raw: string;
}

export interface EducationEntry {
  degree: string;
  institution: string;
  period: string | null;
  raw: string;
}

export interface ResumeProfile {
  name: string | null;
  email: string | null;
  phone: string | null;
  headline: string | null;
  skills: string[];
  education: EducationEntry[];
  experience: ExperienceEntry[];
  certifications: string[];
  achievements: string[];
  totalYears: number | null;
  industries: string[];
  hasBachelor: boolean;
  hasMaster: boolean;
  degreeFields: string[];
  suggestedTitles: string[];
}

export interface ResumeVersion {
  id: string;
  name: string;
  fileName: string;
  fileType: 'pdf' | 'docx';
  fileSize: number;
  hasStoredFile: boolean;
  text: string;
  textHash: string;
  profile: ResumeProfile;
  aiProfile: {
    summary: string;
    strengths: string[];
    suggestedTitles: string[];
    model: string;
    generatedAt: string;
    textHash: string;
  } | null;
  isPrimary: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface CountryPref {
  code: string;
  name: string;
  priority: 1 | 2 | 3;
  enabled: boolean;
}

export interface BoardRef {
  source: AtsSource;
  token: string;
  name: string | null;
  website: string | null;
}

export interface NotificationPrefs {
  newExcellent: boolean;
  excellentThreshold: number;
  closingSoon: boolean;
  savedUnavailable: boolean;
  followUps: boolean;
  interviews: boolean;
  statusChanges: boolean;
  previouslyAppliedCompanies: boolean;
}

export interface Preferences {
  countries: CountryPref[];
  targetTitles: string[];
  excludeTitleKeywords: string[];
  includeOlder: boolean;
  includeUndated: boolean;
  requiresSponsorship: boolean;
  minRecommendedScore: number;
  boards: BoardRef[];
  aggregators: { adzuna: boolean; reed: boolean };
  maxQueriesPerSource: number;
  notifications: NotificationPrefs;
  updatedAt: string;
}

export type NotificationKind =
  | 'new_excellent' | 'closing_soon' | 'saved_unavailable' | 'follow_up' | 'interview' | 'status_change' | 'company_new_job' | 'refresh';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  jobId: string | null;
  createdAt: string;
  read: boolean;
}

export interface RefreshMeta {
  lastAttemptAt: string | null;
  lastSuccessAt: string | null;
  lastStatus: 'success' | 'partial' | 'failed' | null;
  lastError: string | null;
  nextScheduledAt: string | null;
  newJobs: number;
  closedJobs: number;
  unverified: number;
  totalActive: number;
  sources: Record<string, { ok: boolean; fetched: number; errors: string[] }>;
  requestedAt: string | null;
}
