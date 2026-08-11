import type { ReactNode } from 'react';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import { money, num } from '@/lib/format';
import { Skeleton } from '@/components/ui/skeleton';
import type { Stage } from '@/features/meta/api';

interface Props {
  stage: Stage;
  count: number;
  value: number;
  loading?: boolean;
  children: ReactNode;
}

export function DealColumn({ stage, count, value, loading, children }: Props) {
  // Die Spalte selbst ist ein Ablageziel — sonst ließe sich in eine leere
  // Spalte nichts ziehen, weil dort keine Karte zum Treffen wäre.
  const { setNodeRef, isOver } = useDroppable({ id: stage.id });

  return (
    <section className="flex w-[280px] shrink-0 flex-col">
      <header className="mb-2 px-1">
        <div className="flex items-baseline justify-between gap-2">
          <h2 className="truncate text-sm font-semibold">{stage.name}</h2>
          <span className="shrink-0 text-xs text-muted-foreground">{num(count)}</span>
        </div>
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">{money(value)}</span>
          <span className="text-xs text-muted-foreground">{stage.probability} %</span>
        </div>
        {/* Fortschrittsbalken als ruhiger Farbakzent je Spalte */}
        <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-secondary">
          <div className="h-full rounded-full bg-primary/60" style={{ width: `${stage.probability}%` }} />
        </div>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          'scrollbar-slim flex min-h-[140px] flex-1 flex-col gap-2 rounded-lg p-1.5 transition-colors',
          isOver ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : 'bg-surface',
        )}
      >
        {loading ? (
          <>
            <Skeleton className="h-[86px] w-full" />
            <Skeleton className="h-[86px] w-full" />
          </>
        ) : (
          children
        )}
      </div>
    </section>
  );
}
