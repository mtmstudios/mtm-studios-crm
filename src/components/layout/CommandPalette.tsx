import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Building2, Handshake, Plus, Users } from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useDebounce } from '@/hooks/useDebounce';
import { useGlobalSearch } from '@/features/meta/api';
import type { EntityType } from '@/integrations/supabase/types';

const ROUTE: Record<EntityType, string> = {
  contact: '/kontakte',
  company: '/firmen',
  deal: '/deals',
};

const ICON = {
  contact: Users,
  company: Building2,
  deal: Handshake,
} as const;

const GROUP_LABEL: Record<EntityType, string> = {
  contact: 'Kontakte',
  company: 'Firmen',
  deal: 'Deals',
};

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
}

export function CommandPalette({ open, onOpenChange }: Props) {
  const [term, setTerm] = useState('');
  const debounced = useDebounce(term, 200);
  const navigate = useNavigate();
  const { data: results = [], isFetching } = useGlobalSearch(debounced);

  // Bei jedem Öffnen frisch anfangen — ein alter Suchbegriff verwirrt mehr,
  // als er spart.
  useEffect(() => {
    if (open) setTerm('');
  }, [open]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const grouped = (['contact', 'company', 'deal'] as EntityType[])
    .map((entity) => ({ entity, items: results.filter((r) => r.entity === entity) }))
    .filter((g) => g.items.length > 0);

  return (
    // Die Treffer kommen bereits gefiltert vom Server — cmdk darf nicht
    // ein zweites Mal filtern, sonst bleibt die Liste leer.
    <CommandDialog open={open} onOpenChange={onOpenChange} commandProps={{ shouldFilter: false }}>
      <CommandInput
        placeholder="Kontakte, Firmen oder Deals suchen …"
        value={term}
        onValueChange={setTerm}
      />
      <CommandList>
        {debounced.trim().length >= 2 && !isFetching && results.length === 0 && (
          <CommandEmpty>Nichts gefunden.</CommandEmpty>
        )}

        {grouped.map(({ entity, items }) => {
          const Icon = ICON[entity];
          return (
            <CommandGroup key={entity} heading={GROUP_LABEL[entity]}>
              {items.map((item) => (
                <CommandItem
                  key={`${entity}-${item.id}`}
                  value={`${entity}-${item.id}`}
                  onSelect={() => go(`${ROUTE[entity]}/${item.id}`)}
                >
                  <Icon className="mr-2 h-4 w-4 text-muted-foreground" />
                  <span className="truncate">{item.title}</span>
                  {item.subtitle && (
                    <span className="ml-2 truncate text-xs text-muted-foreground">{item.subtitle}</span>
                  )}
                </CommandItem>
              ))}
            </CommandGroup>
          );
        })}

        {grouped.length > 0 && <CommandSeparator />}

        <CommandGroup heading="Neu anlegen">
          <CommandItem value="neu-kontakt" onSelect={() => go('/kontakte?neu=1')}>
            <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
            Kontakt
          </CommandItem>
          <CommandItem value="neu-firma" onSelect={() => go('/firmen?neu=1')}>
            <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
            Firma
          </CommandItem>
          <CommandItem value="neu-deal" onSelect={() => go('/deals?neu=1')}>
            <Plus className="mr-2 h-4 w-4 text-muted-foreground" />
            Deal
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
