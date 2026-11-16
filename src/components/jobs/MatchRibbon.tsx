import clsx from 'clsx';
import { MATCH_WEIGHTS, type MatchComponents, type MatchResult } from '@shared/types';

const ORDER: (keyof MatchComponents)[] = ['skills', 'experience', 'responsibilities', 'education', 'industry', 'location'];
export const COMPONENT_LABELS: Record<keyof MatchComponents, string> = {
  skills: 'Skills', experience: 'Experience', responsibilities: 'Responsibilities', education: 'Education', industry: 'Industry', location: 'Location & visa',
};

export function scoreTone(score: number): string {
  if (score >= 80) return 'text-good';
  if (score >= 70) return 'text-accent';
  if (score >= 60) return 'text-warn';
  return 'text-muted';
}
function fill(score: number): string {
  if (score >= 80) return 'bg-good';
  if (score >= 70) return 'bg-accent';
  if (score >= 60) return 'bg-warn';
  return 'bg-faint';
}

/**
 * Six segments sized by their weight (30/25/20/10/10/5). Each fills by how
 * many of its points were earned, so the shape of a match is readable at a glance.
 */
export function MatchRibbon({ match, size = 'sm', showScore = true }: { match: MatchResult | null; size?: 'sm' | 'lg'; showScore?: boolean }) {
  if (!match) {
    return <span className="text-xs text-faint" title="Upload a resume to score this vacancy">Not scored</span>;
  }
  const c = fill(match.score);
  const tip = ORDER.map((k) => `${COMPONENT_LABELS[k]} ${match.components[k]}/${MATCH_WEIGHTS[k]}`).join('\n');
  return (
    <div className={clsx('flex items-center', size === 'lg' ? 'gap-3' : 'gap-2')} title={`${match.score}/100 — ${match.label} match\n${tip}`}>
      {showScore && <span className={clsx('num font-semibold tabular-nums', size === 'lg' ? 'text-3xl w-14' : 'text-sm w-7 text-right', scoreTone(match.score))}>{match.score}</span>}
      <div className={clsx('flex', size === 'lg' ? 'gap-1 h-2.5 w-full' : 'gap-[2px] h-1.5 w-[5.5rem]')} aria-hidden>
        {ORDER.map((k) => (
          <div key={k} className="relative overflow-hidden rounded-[2px] bg-line" style={{ flex: MATCH_WEIGHTS[k] }}>
            <div className={clsx('absolute inset-y-0 left-0', c)} style={{ width: `${Math.min(100, (match.components[k] / MATCH_WEIGHTS[k]) * 100)}%` }} />
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchBreakdown({ match }: { match: MatchResult }) {
  return (
    <div className="space-y-3">
      {ORDER.map((k) => {
        const v = match.components[k];
        const w = MATCH_WEIGHTS[k];
        return (
          <div key={k}>
            <div className="flex items-baseline justify-between text-sm">
              <span className="font-medium">{COMPONENT_LABELS[k]}</span>
              <span className="num text-muted"><span className="text-ink font-medium">{v}</span> / {w}</span>
            </div>
            <div className="mt-1.5 h-1.5 rounded-full bg-line overflow-hidden">
              <div className={clsx('h-full rounded-full', fill((v / w) * 100))} style={{ width: `${(v / w) * 100}%` }} />
            </div>
            {match.notes[k] && <p className="text-xs text-muted mt-1">{match.notes[k]}</p>}
          </div>
        );
      })}
    </div>
  );
}
