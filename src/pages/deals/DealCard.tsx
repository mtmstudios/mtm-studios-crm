import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { AlertTriangle, Building2, CalendarDays, User } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dateShort, initials, money } from '@/lib/format';
import { isRotting, type DealRow } from '@/features/deals/api';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';

interface Props {
  deal: DealRow;
  onOpen?(): void;
  /** Darstellung in der Drag-Vorschau — ohne Sortable-Verdrahtung */
  overlay?: boolean;
}

export function DealCard({ deal, onOpen, overlay }: Props) {
  const sortable = useSortable({ id: deal.id, disabled: overlay });
  const rotting = isRotting(deal);
  const overdue =
    deal.expected_close_date &&
    deal.status === 'open' &&
    new Date(deal.expected_close_date) < new Date();

  const style = overlay
    ? undefined
    : {
        transform: CSS.Translate.toString(sortable.transform),
        transition: sortable.transition,
      };

  return (
    <article
      ref={overlay ? undefined : sortable.setNodeRef}
      style={style}
      {...(overlay ? {} : sortable.attributes)}
      {...(overlay ? {} : sortable.listeners)}
      onClick={onOpen}
      className={cn(
        'group cursor-grab rounded-md border border-border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing',
        !overlay && sortable.isDragging && 'dragging',
        overlay && 'rotate-2 cursor-grabbing shadow-lg',
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="line-clamp-2 text-sm font-medium leading-snug">{deal.title}</h3>
        {rotting && (
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="shrink-0 text-amber-500">
                <AlertTriangle className="h-3.5 w-3.5" />
              </span>
            </TooltipTrigger>
            <TooltipContent>
              Liegt länger als {deal.stages?.rotting_days} Tage in dieser Phase
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      <div className="mt-1.5 text-sm font-semibold tabular-nums">{money(deal.value)}</div>

      <div className="mt-2 space-y-1 text-xs text-muted-foreground">
        {deal.companies && (
          <div className="flex items-center gap-1.5">
            <Building2 className="h-3 w-3 shrink-0" />
            <span className="truncate">{deal.companies.name}</span>
          </div>
        )}
        {deal.contacts && (
          <div className="flex items-center gap-1.5">
            <User className="h-3 w-3 shrink-0" />
            <span className="truncate">{deal.contacts.full_name}</span>
          </div>
        )}
        {deal.expected_close_date && (
          <div className={cn('flex items-center gap-1.5', overdue && 'font-medium text-destructive')}>
            <CalendarDays className="h-3 w-3 shrink-0" />
            <span>{dateShort(deal.expected_close_date)}</span>
          </div>
        )}
      </div>

      {deal.owner && (
        <div className="mt-2 flex justify-end">
          <Tooltip>
            <TooltipTrigger asChild>
              <span className="grid h-5 w-5 place-items-center rounded-full bg-secondary text-[9px] font-semibold text-secondary-foreground">
                {initials(deal.owner.full_name)}
              </span>
            </TooltipTrigger>
            <TooltipContent>{deal.owner.full_name}</TooltipContent>
          </Tooltip>
        </div>
      )}
    </article>
  );
}
