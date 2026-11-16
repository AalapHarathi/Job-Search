import { MoreHorizontal, ExternalLink, Globe, Bookmark, Send, ThumbsDown, Sparkles, FileText, BookmarkCheck } from 'lucide-react';
import { Menu } from '@/components/ui/Menu';
import { IconButton } from '@/components/ui';
import { useUI } from '@/context/UIContext';
import { useJobActions } from './useJobActions';
import type { Job } from '@shared/types';
import { safeUrl } from '@/lib/format';

export function JobRowMenu({ job }: { job: Job }) {
  const { openJob } = useUI();
  const a = useJobActions();
  const apply = safeUrl(job.applicationUrl);
  return (
    <Menu
      trigger={() => <IconButton label="Job actions"><MoreHorizontal className="size-4" /></IconButton>}
      items={[
        { label: 'View job description', icon: <FileText className="size-4" />, onClick: () => openJob(job.id, 'description') },
        { label: 'View match analysis', icon: <Sparkles className="size-4" />, onClick: () => openJob(job.id, 'match') },
        'sep',
        apply
          ? { label: 'Apply on company site', icon: <ExternalLink className="size-4" />, href: apply }
          : { label: 'Open job-board listing', icon: <ExternalLink className="size-4" />, href: safeUrl(job.sourceUrl) ?? undefined, hint: 'Employer application link not found' },
        { label: 'Company website', icon: <Globe className="size-4" />, href: safeUrl(job.companyWebsite) ?? undefined, disabled: !job.companyWebsite },
        'sep',
        { label: job.status === 'Saved' ? 'Unsave' : 'Save job', icon: job.status === 'Saved' ? <BookmarkCheck className="size-4" /> : <Bookmark className="size-4" />, onClick: () => a.toggleSave(job) },
        { label: 'Mark as applied', icon: <Send className="size-4" />, onClick: () => a.markApplied(job) },
        { label: 'Not interested', icon: <ThumbsDown className="size-4" />, onClick: () => a.setStatus(job, 'Not Interested'), danger: true },
      ]}
    />
  );
}
