import { useEffect, useState, type ReactNode } from 'react';
import { Filter, Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useDebounce } from '@/hooks/useDebounce';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Separator } from '@/components/ui/separator';

export interface FilterDef {
  column: string;
  label: string;
  options: { value: string; label: string }[];
}

interface Props {
  search: string;
  onSearchChange(value: string): void;
  placeholder?: string;
  filters?: FilterDef[];
  active: Record<string, string[]>;
  onFilterChange(column: string, values: string[]): void;
  onClear(): void;
  activeCount: number;
  /** Aktionen rechts in der Leiste (z. B. „Neu") */
  children?: ReactNode;
}

export function ListToolbar({
  search,
  onSearchChange,
  placeholder = 'Suchen …',
  filters = [],
  active,
  onFilterChange,
  onClear,
  activeCount,
  children,
}: Props) {
  // Eingabe lokal halten und verzögert nach oben geben, damit nicht jeder
  // Tastendruck eine Abfrage auslöst.
  const [term, setTerm] = useState(search);
  const debounced = useDebounce(term, 300);

  useEffect(() => {
    if (debounced !== search) onSearchChange(debounced);
    // onSearchChange ändert sich bei jedem Render der Elternkomponente und
    // gehört deshalb bewusst nicht in die Abhängigkeiten.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced]);

  // Zurücksetzen von außen (z. B. „Filter löschen") ins Feld spiegeln
  useEffect(() => {
    if (!search && term) setTerm('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder={placeholder}
          className="h-9 pl-8"
        />
        {term && (
          <button
            type="button"
            onClick={() => setTerm('')}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Suche leeren"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {filters.map((filter) => {
        const values = active[filter.column] ?? [];
        return (
          <Popover key={filter.column}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className={cn('h-9 gap-1.5', values.length && 'border-primary/40 bg-primary/5')}
              >
                <Filter className="h-3.5 w-3.5" />
                {filter.label}
                {values.length > 0 && (
                  <Badge variant="secondary" className="ml-0.5 h-5 px-1.5 text-[11px]">
                    {values.length}
                  </Badge>
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-56 p-1">
              <div className="max-h-72 overflow-y-auto">
                {filter.options.map((option) => {
                  const checked = values.includes(option.value);
                  return (
                    <label
                      key={option.value}
                      className="flex cursor-pointer items-center gap-2 rounded-sm px-2 py-1.5 text-sm hover:bg-accent"
                    >
                      <Checkbox
                        checked={checked}
                        onCheckedChange={() =>
                          onFilterChange(
                            filter.column,
                            checked
                              ? values.filter((v) => v !== option.value)
                              : [...values, option.value],
                          )
                        }
                      />
                      <span className="truncate">{option.label}</span>
                    </label>
                  );
                })}
              </div>
              {values.length > 0 && (
                <>
                  <Separator className="my-1" />
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 w-full justify-start text-muted-foreground"
                    onClick={() => onFilterChange(filter.column, [])}
                  >
                    Zurücksetzen
                  </Button>
                </>
              )}
            </PopoverContent>
          </Popover>
        );
      })}

      {(activeCount > 0 || search) && (
        <Button variant="ghost" size="sm" className="h-9 gap-1 text-muted-foreground" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
          Zurücksetzen
        </Button>
      )}

      {children && <div className="ml-auto flex items-center gap-2">{children}</div>}
    </div>
  );
}
