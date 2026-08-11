import { useState } from 'react';
import { Check, ChevronsUpDown, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';

export interface ComboOption {
  value: string;
  label: string;
  hint?: string | null;
}

interface Props {
  value: string | null;
  onChange(value: string | null): void;
  options: ComboOption[];
  /** Wird gesetzt, wenn die Optionen serverseitig gesucht werden. */
  onSearchChange?(term: string): void;
  placeholder?: string;
  emptyText?: string;
  loading?: boolean;
  disabled?: boolean;
  clearable?: boolean;
  className?: string;
}

/**
 * Auswahlfeld mit Typeahead. Bei serverseitiger Suche (onSearchChange gesetzt)
 * wird die Filterung in cmdk abgeschaltet, sonst würde doppelt gefiltert.
 */
export function EntityCombobox({
  value,
  onChange,
  options,
  onSearchChange,
  placeholder = 'Auswählen …',
  emptyText = 'Nichts gefunden.',
  loading,
  disabled,
  clearable = true,
  className,
}: Props) {
  const [open, setOpen] = useState(false);
  const selected = options.find((o) => o.value === value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn('h-9 w-full justify-between font-normal', !selected && 'text-muted-foreground', className)}
        >
          <span className="truncate">{selected?.label ?? placeholder}</span>
          <span className="flex shrink-0 items-center gap-1">
            {clearable && value && (
              <span
                role="button"
                tabIndex={-1}
                aria-label="Auswahl entfernen"
                onClick={(e) => {
                  e.stopPropagation();
                  onChange(null);
                }}
                className="rounded-sm p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </span>
            )}
            <ChevronsUpDown className="h-4 w-4 opacity-50" />
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command shouldFilter={!onSearchChange}>
          <CommandInput placeholder="Suchen …" onValueChange={onSearchChange} />
          <CommandList>
            {!loading && options.length === 0 && <CommandEmpty>{emptyText}</CommandEmpty>}
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={onSearchChange ? option.value : `${option.label} ${option.hint ?? ''}`}
                  onSelect={() => {
                    onChange(option.value === value ? null : option.value);
                    setOpen(false);
                  }}
                >
                  <Check
                    className={cn(
                      'mr-2 h-4 w-4',
                      option.value === value ? 'opacity-100' : 'opacity-0',
                    )}
                  />
                  <span className="truncate">{option.label}</span>
                  {option.hint && (
                    <span className="ml-2 truncate text-xs text-muted-foreground">{option.hint}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
