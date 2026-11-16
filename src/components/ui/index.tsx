import clsx from 'clsx';
import { X, Loader2 } from 'lucide-react';
import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode, type InputHTMLAttributes, type SelectHTMLAttributes, type TextareaHTMLAttributes } from 'react';

type BtnVariant = 'primary' | 'secondary' | 'ghost' | 'danger';
export function Button({ variant = 'secondary', size = 'md', loading, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: BtnVariant; size?: 'sm' | 'md'; loading?: boolean }) {
  return (
    <button
      {...p}
      disabled={p.disabled || loading}
      className={clsx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg font-medium whitespace-nowrap transition-colors disabled:opacity-50 disabled:cursor-not-allowed select-none',
        size === 'sm' ? 'h-7 px-2.5 text-[0.8125rem]' : 'h-9 px-3.5 text-sm',
        variant === 'primary' && 'bg-accent text-white dark:text-[#0f1115] hover:bg-accent/90',
        variant === 'secondary' && 'bg-surface border border-line text-ink hover:bg-raised',
        variant === 'ghost' && 'text-muted hover:text-ink hover:bg-raised',
        variant === 'danger' && 'bg-surface border border-bad/40 text-bad hover:bg-bad/5',
        className,
      )}
    >
      {loading && <Loader2 className="size-3.5 animate-spin" />}
      {children}
    </button>
  );
}

export function IconButton({ label, className, children, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string }) {
  return (
    <button {...p} aria-label={label} title={label} className={clsx('inline-flex size-8 items-center justify-center rounded-lg text-muted hover:text-ink hover:bg-raised transition-colors', className)}>
      {children}
    </button>
  );
}

export type Tone = 'neutral' | 'accent' | 'good' | 'warn' | 'bad';
export function Badge({ tone = 'neutral', children, className, title }: { tone?: Tone; children: ReactNode; className?: string; title?: string }) {
  return (
    <span title={title} className={clsx(
      'inline-flex items-center gap-1 rounded-md px-1.5 h-[1.375rem] text-[0.75rem] font-medium whitespace-nowrap border',
      tone === 'neutral' && 'bg-raised text-muted border-line',
      tone === 'accent' && 'bg-accent-soft text-accent border-accent/20',
      tone === 'good' && 'bg-good/10 text-good border-good/20',
      tone === 'warn' && 'bg-warn/10 text-warn border-warn/25',
      tone === 'bad' && 'bg-bad/10 text-bad border-bad/20',
      className,
    )}>{children}</span>
  );
}

export function Field({ label, hint, children, className }: { label: string; hint?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <label className={clsx('block', className)}>
      <span className="block text-[0.8125rem] font-medium text-ink mb-1.5">{label}</span>
      {children}
      {hint && <span className="block text-xs text-muted mt-1">{hint}</span>}
    </label>
  );
}
export const Input = ({ className, ...p }: InputHTMLAttributes<HTMLInputElement>) => <input {...p} className={clsx('input', className)} />;
export const Textarea = ({ className, ...p }: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...p} className={clsx('input h-auto py-2 min-h-[5rem] leading-relaxed', className)} />;
export const Select = ({ className, children, ...p }: SelectHTMLAttributes<HTMLSelectElement>) => (
  <select {...p} className={clsx('input pr-8 appearance-none bg-[length:12px] bg-[right_0.6rem_center] bg-no-repeat cursor-pointer', className)}
    style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 12 12'%3E%3Cpath d='M3 4.5 6 7.5 9 4.5' fill='none' stroke='%23888' stroke-width='1.4'/%3E%3C/svg%3E\")" }}>
    {children}
  </select>
);

export function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <label className="flex items-start justify-between gap-4 py-2.5 cursor-pointer">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        {description && <span className="block text-xs text-muted mt-0.5 max-w-[56ch]">{description}</span>}
      </span>
      <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)}
        className={clsx('relative mt-0.5 h-5 w-9 shrink-0 rounded-full transition-colors', checked ? 'bg-accent' : 'bg-line')}>
        <span className={clsx('absolute top-0.5 size-4 rounded-full bg-white shadow transition-transform', checked ? 'translate-x-[1.125rem]' : 'translate-x-0.5')} />
      </button>
    </label>
  );
}

function useEscape(onClose: () => void) {
  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

export function Modal({ open, onClose, title, children, footer, width = 'max-w-lg' }: { open: boolean; onClose: () => void; title: string; children: ReactNode; footer?: ReactNode; width?: string }) {
  useEscape(onClose);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (open) ref.current?.querySelector<HTMLElement>('input,select,textarea,button')?.focus(); }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-6">
      <div className="absolute inset-0 bg-black/40 anim-fade" onClick={onClose} />
      <div ref={ref} role="dialog" aria-modal="true" aria-label={title} className={clsx('relative w-full bg-surface border border-line rounded-t-2xl sm:rounded-2xl shadow-pop anim-pop max-h-[92vh] flex flex-col', width)}>
        <div className="flex items-center justify-between px-5 h-14 border-b border-line shrink-0">
          <h2 className="h-section">{title}</h2>
          <IconButton label="Close" onClick={onClose}><X className="size-4" /></IconButton>
        </div>
        <div className="px-5 py-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-5 py-3 border-t border-line flex justify-end gap-2 shrink-0">{footer}</div>}
      </div>
    </div>
  );
}

export function Drawer({ open, onClose, children, label }: { open: boolean; onClose: () => void; children: ReactNode; label: string }) {
  useEscape(onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-40">
      <div className="absolute inset-0 bg-black/25 anim-fade" onClick={onClose} />
      <aside role="dialog" aria-modal="true" aria-label={label} className="absolute right-0 top-0 h-full w-full max-w-[44rem] bg-surface border-l border-line shadow-pop anim-drawer flex flex-col">
        {children}
      </aside>
    </div>
  );
}

export function Empty({ icon, title, children, action }: { icon?: ReactNode; title: string; children?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center text-center px-6 py-14">
      {icon && <div className="mb-3 text-faint">{icon}</div>}
      <p className="text-sm font-medium">{title}</p>
      {children && <div className="text-sm text-muted mt-1 max-w-[52ch]">{children}</div>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={clsx('animate-spin text-muted', className ?? 'size-5')} />;
}

export function Tabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { id: T; label: ReactNode }[] }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line overflow-x-auto">
      {items.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={clsx('relative h-10 px-3 text-sm whitespace-nowrap transition-colors', value === t.id ? 'text-ink font-medium' : 'text-muted hover:text-ink')}>
          {t.label}
          {value === t.id && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-accent" />}
        </button>
      ))}
    </div>
  );
}

export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
      <div>
        <h1 className="h-page">{title}</h1>
        {description && <p className="text-sm text-muted mt-1 max-w-[70ch]">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Section({ title, action, children, className, bodyClass }: { title: string; action?: ReactNode; children: ReactNode; className?: string; bodyClass?: string }) {
  return (
    <section className={clsx('panel', className)}>
      <header className="flex items-center justify-between gap-3 px-4 h-12 border-b border-line">
        <h2 className="h-section">{title}</h2>
        {action}
      </header>
      <div className={bodyClass ?? 'p-4'}>{children}</div>
    </section>
  );
}
