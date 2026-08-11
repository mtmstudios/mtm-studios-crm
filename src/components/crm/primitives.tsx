import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { avatarTone, initials } from '@/lib/format';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type {
  ActivityType,
  ApptStatus,
  CompanyStatus,
  ContactStatus,
  DealStatus,
} from '@/integrations/supabase/types';

/* -------------------------------------------------------------- Kopfzeile -- */

export function PageHeader({
  title,
  subtitle,
  children,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
      <div className="min-w-0">
        <h1 className="truncate text-xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
    </div>
  );
}

/* ----------------------------------------------------------------- Avatar -- */

export function EntityAvatar({
  name,
  seed,
  size = 'md',
  square,
}: {
  name: string | null | undefined;
  seed: string;
  size?: 'sm' | 'md' | 'lg';
  /** Firmen werden eckig dargestellt, Personen rund */
  square?: boolean;
}) {
  const sizes = {
    sm: 'h-6 w-6 text-[10px]',
    md: 'h-8 w-8 text-xs',
    lg: 'h-12 w-12 text-sm',
  } as const;

  return (
    <span
      className={cn(
        'inline-grid shrink-0 place-items-center font-semibold',
        square ? 'rounded-md' : 'rounded-full',
        sizes[size],
        avatarTone(seed),
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  );
}

/* ----------------------------------------------------------------- Status -- */

const COMPANY_STATUS: Record<CompanyStatus, { label: string; className: string }> = {
  lead: { label: 'Lead', className: 'bg-slate-100 text-slate-700 hover:bg-slate-100' },
  prospect: { label: 'Interessent', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
  customer: { label: 'Kunde', className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' },
  partner: { label: 'Partner', className: 'bg-violet-100 text-violet-800 hover:bg-violet-100' },
  inactive: { label: 'Inaktiv', className: 'bg-zinc-100 text-zinc-500 hover:bg-zinc-100' },
};

const CONTACT_STATUS: Record<ContactStatus, { label: string; className: string }> = {
  lead: { label: 'Lead', className: 'bg-slate-100 text-slate-700 hover:bg-slate-100' },
  active: { label: 'Aktiv', className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' },
  inactive: { label: 'Inaktiv', className: 'bg-zinc-100 text-zinc-500 hover:bg-zinc-100' },
};

const DEAL_STATUS: Record<DealStatus, { label: string; className: string }> = {
  open: { label: 'Offen', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  won: { label: 'Gewonnen', className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' },
  lost: { label: 'Verloren', className: 'bg-rose-100 text-rose-800 hover:bg-rose-100' },
};

const APPT_STATUS: Record<ApptStatus, { label: string; className: string }> = {
  scheduled: { label: 'Geplant', className: 'bg-blue-100 text-blue-800 hover:bg-blue-100' },
  confirmed: { label: 'Bestätigt', className: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100' },
  cancelled: { label: 'Abgesagt', className: 'bg-rose-100 text-rose-800 hover:bg-rose-100' },
  completed: { label: 'Erledigt', className: 'bg-zinc-100 text-zinc-600 hover:bg-zinc-100' },
  no_show: { label: 'Nicht erschienen', className: 'bg-amber-100 text-amber-800 hover:bg-amber-100' },
};

const MAPS = {
  company: COMPANY_STATUS,
  contact: CONTACT_STATUS,
  deal: DEAL_STATUS,
  appointment: APPT_STATUS,
} as const;

export const COMPANY_STATUS_OPTIONS = Object.entries(COMPANY_STATUS).map(([value, v]) => ({
  value,
  label: v.label,
}));
export const CONTACT_STATUS_OPTIONS = Object.entries(CONTACT_STATUS).map(([value, v]) => ({
  value,
  label: v.label,
}));
export const DEAL_STATUS_OPTIONS = Object.entries(DEAL_STATUS).map(([value, v]) => ({
  value,
  label: v.label,
}));

export function StatusBadge({
  kind,
  value,
}: {
  kind: keyof typeof MAPS;
  value: string | null | undefined;
}) {
  const map = MAPS[kind] as Record<string, { label: string; className: string }>;
  const entry = value ? map[value] : undefined;
  if (!entry) return <span className="text-muted-foreground">—</span>;
  return (
    <Badge variant="secondary" className={cn('font-medium', entry.className)}>
      {entry.label}
    </Badge>
  );
}

/* ------------------------------------------------------------ Aktivitäten -- */

export const ACTIVITY_LABEL: Record<ActivityType, string> = {
  call: 'Anruf',
  meeting: 'Termin',
  task: 'Aufgabe',
  email: 'E-Mail',
  deadline: 'Frist',
  lunch: 'Essen',
};

export const ACTIVITY_OPTIONS = Object.entries(ACTIVITY_LABEL).map(([value, label]) => ({
  value,
  label,
}));

/* ------------------------------------------------------------ Leerzustand -- */

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon?: React.ComponentType<{ className?: string }>;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="mx-auto flex max-w-sm flex-col items-center px-6 text-center">
      {Icon && (
        <span className="mb-3 grid h-11 w-11 place-items-center rounded-full bg-secondary text-muted-foreground">
          <Icon className="h-5 w-5" />
        </span>
      )}
      <h3 className="text-sm font-semibold">{title}</h3>
      {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

/* -------------------------------------------------------- Sammelaktionen -- */

export function BulkBar({
  count,
  onClear,
  children,
}: {
  count: number;
  onClear(): void;
  children: ReactNode;
}) {
  if (count === 0) return null;
  return (
    <div className="sticky bottom-4 z-10 mx-auto flex w-fit max-w-[95%] flex-wrap items-center gap-2 rounded-lg border border-border bg-popover px-3 py-2 shadow-lg">
      <span className="text-sm font-medium">
        {count} {count === 1 ? 'Eintrag' : 'Einträge'}
      </span>
      <span className="h-4 w-px bg-border" />
      {children}
      <Button variant="ghost" size="sm" className="h-8" onClick={onClear}>
        Auswahl aufheben
      </Button>
    </div>
  );
}

/* ------------------------------------------------------------ Eigenschaft -- */

export function PropertyRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[minmax(0,7rem)_1fr] items-start gap-3 py-1.5 text-sm">
      <dt className="truncate pt-1 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}
