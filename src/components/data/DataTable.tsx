import type { ReactNode } from 'react';
import { AlertTriangle, ArrowDown, ArrowUp, ChevronsUpDown, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';

export interface Column<T> {
  /** Schlüssel; entspricht der Datenbankspalte, wenn sortierbar */
  key: string;
  header: string;
  sortable?: boolean;
  /** Zusätzliche Klassen für Kopf- und Datenzelle (Breite, Ausrichtung) */
  className?: string;
  /** Ab welcher Breite die Spalte eingeblendet wird */
  hideBelow?: 'sm' | 'md' | 'lg' | 'xl';
  render(row: T): ReactNode;
}

const HIDE_CLASS = {
  sm: 'hidden sm:table-cell',
  md: 'hidden md:table-cell',
  lg: 'hidden lg:table-cell',
  xl: 'hidden xl:table-cell',
} as const;

interface Props<T> {
  rows: T[];
  columns: Column<T>[];
  rowId(row: T): string;
  loading?: boolean;
  sort?: string;
  asc?: boolean;
  onSort?(column: string): void;
  onRowClick?(row: T): void;
  selected?: Set<string>;
  onSelectedChange?(next: Set<string>): void;
  empty?: ReactNode;
  /**
   * Fehler der Abfrage. Muss durchgereicht werden — ohne ihn wäre eine
   * fehlgeschlagene Abfrage von „keine Treffer" nicht zu unterscheiden, und
   * genau das verschleiert echte Fehler.
   */
  error?: Error | null;
  onRetry?(): void;
  /** Zeilen im Ladezustand */
  skeletonRows?: number;
}

export function DataTable<T>({
  rows,
  columns,
  rowId,
  loading,
  sort,
  asc,
  onSort,
  onRowClick,
  selected,
  onSelectedChange,
  empty,
  error,
  onRetry,
  skeletonRows = 8,
}: Props<T>) {
  const selectable = !!selected && !!onSelectedChange;
  const pageIds = rows.map(rowId);
  const allSelected = selectable && pageIds.length > 0 && pageIds.every((id) => selected!.has(id));
  const someSelected = selectable && pageIds.some((id) => selected!.has(id)) && !allSelected;

  const toggleAll = () => {
    const next = new Set(selected);
    // Auswahl gilt nur für die sichtbare Seite — sonst würde ein Klick
    // unsichtbare Datensätze mit erfassen.
    if (allSelected) pageIds.forEach((id) => next.delete(id));
    else pageIds.forEach((id) => next.add(id));
    onSelectedChange!(next);
  };

  const toggleOne = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onSelectedChange!(next);
  };

  // Ein Fehler hat Vorrang vor dem Leerzustand — sonst sieht ein Ausfall
  // aus wie ein leerer Bestand.
  if (error) {
    return (
      <div className="mx-auto max-w-lg px-6 py-16 text-center">
        <span className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-full bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" />
        </span>
        <h3 className="text-sm font-semibold">Daten konnten nicht geladen werden</h3>
        <p className="mt-1 text-sm text-muted-foreground">
          Die Abfrage wurde abgelehnt. Das liegt meist an fehlenden Rechten oder einer
          Änderung am Datenmodell.
        </p>
        <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-md bg-secondary p-3 text-left text-xs text-muted-foreground">
          {error.message}
        </pre>
        {onRetry && (
          <Button variant="outline" size="sm" className="mt-4" onClick={onRetry}>
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
            Erneut versuchen
          </Button>
        )}
      </div>
    );
  }

  if (!loading && rows.length === 0) {
    return <div className="py-16">{empty}</div>;
  }

  return (
    <div className="scrollbar-slim w-full overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border bg-surface text-xs uppercase tracking-wide text-muted-foreground">
            {selectable && (
              <th className="w-10 px-3 py-2.5">
                <Checkbox
                  checked={allSelected ? true : someSelected ? 'indeterminate' : false}
                  onCheckedChange={toggleAll}
                  aria-label="Alle auf dieser Seite auswählen"
                />
              </th>
            )}
            {columns.map((col) => {
              const active = sort === col.key;
              return (
                <th
                  key={col.key}
                  className={cn(
                    'px-3 py-2.5 text-left font-medium',
                    col.hideBelow && HIDE_CLASS[col.hideBelow],
                    col.className,
                  )}
                >
                  {col.sortable && onSort ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.key)}
                      className="inline-flex items-center gap-1 transition-colors hover:text-foreground"
                    >
                      {col.header}
                      {active ? (
                        asc ? (
                          <ArrowUp className="h-3 w-3" />
                        ) : (
                          <ArrowDown className="h-3 w-3" />
                        )
                      ) : (
                        <ChevronsUpDown className="h-3 w-3 opacity-40" />
                      )}
                    </button>
                  ) : (
                    col.header
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {loading && rows.length === 0
            ? Array.from({ length: skeletonRows }).map((_, i) => (
                <tr key={i} className="border-b border-border">
                  {selectable && (
                    <td className="px-3 py-3">
                      <Skeleton className="h-4 w-4" />
                    </td>
                  )}
                  {columns.map((col) => (
                    <td
                      key={col.key}
                      className={cn('px-3 py-3', col.hideBelow && HIDE_CLASS[col.hideBelow])}
                    >
                      <Skeleton className="h-4 w-full max-w-[160px]" />
                    </td>
                  ))}
                </tr>
              ))
            : rows.map((row) => {
                const id = rowId(row);
                const isSelected = selected?.has(id) ?? false;
                return (
                  <tr
                    key={id}
                    onClick={onRowClick ? () => onRowClick(row) : undefined}
                    className={cn(
                      'data-row',
                      onRowClick && 'cursor-pointer',
                      isSelected && 'bg-primary/5',
                    )}
                  >
                    {selectable && (
                      <td className="px-3 py-2.5" onClick={(e) => e.stopPropagation()}>
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleOne(id)}
                          aria-label="Zeile auswählen"
                        />
                      </td>
                    )}
                    {columns.map((col) => (
                      <td
                        key={col.key}
                        className={cn(
                          'px-3 py-2.5 align-middle',
                          col.hideBelow && HIDE_CLASS[col.hideBelow],
                          col.className,
                        )}
                      >
                        {col.render(row)}
                      </td>
                    ))}
                  </tr>
                );
              })}
        </tbody>
      </table>
    </div>
  );
}
