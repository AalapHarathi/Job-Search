import { BadgeCheck, CircleDashed, CircleSlash, ShieldCheck, ShieldQuestion, ShieldX, ShieldAlert, Home } from 'lucide-react';
import { Badge, type Tone } from '@/components/ui';
import { SPONSORSHIP_LABELS, type ApplicationStatus, type Job, type SponsorshipCategory, type VerificationStatus } from '@shared/types';
import { freshness, type Freshness } from '@shared/freshness';

const SP_TONE: Record<SponsorshipCategory, Tone> = { A: 'good', B: 'accent', C: 'neutral', D: 'bad', E: 'warn', N: 'neutral' };
const SP_SHORT: Record<SponsorshipCategory, string> = { A: 'Sponsors', B: 'Possible', C: 'Not mentioned', D: 'No sponsorship', E: 'Local auth only', N: 'Home country' };
const SP_ICON = { A: ShieldCheck, B: ShieldQuestion, C: ShieldQuestion, D: ShieldX, E: ShieldAlert, N: Home };

export function SponsorshipBadge({ category, long }: { category: SponsorshipCategory; long?: boolean }) {
  const Icon = SP_ICON[category];
  return <Badge tone={SP_TONE[category]} title={SPONSORSHIP_LABELS[category]}><Icon className="size-3" />{long ? SPONSORSHIP_LABELS[category] : SP_SHORT[category]}</Badge>;
}

export function VerificationBadge({ status, note }: { status: VerificationStatus; note?: string | null }) {
  if (status === 'Verified') return <Badge tone="good" title={note ?? 'Confirmed on the employer’s own listing'}><BadgeCheck className="size-3" />Verified</Badge>;
  if (status === 'Closed') return <Badge tone="bad" title={note ?? 'Closed'}><CircleSlash className="size-3" />Closed</Badge>;
  return <Badge tone="warn" title={note ?? 'Not confirmed on the employer’s site'}><CircleDashed className="size-3" />Unverified</Badge>;
}

const FR_TONE: Record<Freshness, Tone> = { 'Very recent': 'accent', Recent: 'accent', Active: 'neutral', 'Older active': 'neutral', Older: 'warn', Undated: 'neutral' };
export function FreshnessBadge({ job }: { job: Job }) {
  const f = freshness(job.postedAt);
  return <Badge tone={FR_TONE[f]} title={job.postedDateSource ?? 'Posting date not provided by source'}>{f}</Badge>;
}

const ST_TONE: Partial<Record<ApplicationStatus, Tone>> = {
  Shortlisted: 'accent', Saved: 'accent', 'Ready to Apply': 'accent', Applied: 'good', Assessment: 'good',
  'Interview Scheduled': 'good', 'Interview Completed': 'good', 'Offer Received': 'good', Rejected: 'bad', Withdrawn: 'neutral', 'Not Interested': 'neutral',
};
export function StatusBadge({ status }: { status: ApplicationStatus }) {
  return <Badge tone={ST_TONE[status] ?? 'neutral'}>{status}</Badge>;
}
