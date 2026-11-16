import { useEffect, useRef, useState, type ReactNode } from 'react';
import clsx from 'clsx';

export interface MenuItem { label: string; icon?: ReactNode; onClick?: () => void; href?: string; danger?: boolean; disabled?: boolean; hint?: string }

export function Menu({ trigger, items, align = 'right' }: { trigger: (open: boolean) => ReactNode; items: (MenuItem | 'sep')[]; align?: 'left' | 'right' }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (!ref.current?.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', h);
    document.addEventListener('keydown', k);
    return () => { document.removeEventListener('mousedown', h); document.removeEventListener('keydown', k); };
  }, [open]);
  return (
    <div ref={ref} className="relative" onClick={(e) => e.stopPropagation()}>
      <div onClick={() => setOpen((o) => !o)}>{trigger(open)}</div>
      {open && (
        <div role="menu" className={clsx('absolute z-30 mt-1 min-w-[13rem] rounded-xl border border-line bg-surface shadow-pop p-1 anim-pop', align === 'right' ? 'right-0' : 'left-0')}>
          {items.map((it, i) => it === 'sep' ? <div key={i} className="my-1 h-px bg-line" /> : it.href ? (
            <a key={i} role="menuitem" href={it.href} target="_blank" rel="noopener noreferrer" onClick={() => setOpen(false)}
              className={clsx('flex items-center gap-2 rounded-lg px-2.5 h-8 text-sm hover:bg-raised', it.disabled && 'pointer-events-none opacity-40')}>
              <span className="text-muted">{it.icon}</span>{it.label}
            </a>
          ) : (
            <button key={i} role="menuitem" disabled={it.disabled} title={it.hint} onClick={() => { setOpen(false); it.onClick?.(); }}
              className={clsx('w-full flex items-center gap-2 rounded-lg px-2.5 h-8 text-sm text-left hover:bg-raised disabled:opacity-40', it.danger && 'text-bad')}>
              <span className={it.danger ? '' : 'text-muted'}>{it.icon}</span>{it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
