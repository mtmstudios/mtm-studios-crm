import { useState } from 'react';
import { Check, Plus, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useCreateTag, useEntityTags, useSetEntityTags, useTags } from '@/features/meta/api';
import { Badge } from '@/components/ui/badge';
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
import type { EntityType } from '@/integrations/supabase/types';

const TONE: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700',
  emerald: 'bg-emerald-100 text-emerald-800',
  violet: 'bg-violet-100 text-violet-800',
  amber: 'bg-amber-100 text-amber-800',
  sky: 'bg-sky-100 text-sky-800',
  rose: 'bg-rose-100 text-rose-800',
};

export function TagPicker({ entity, entityId }: { entity: EntityType; entityId: string }) {
  const { data: all = [] } = useTags();
  const { data: current = [] } = useEntityTags(entity, entityId);
  const setTags = useSetEntityTags(entity, entityId);
  const createTag = useCreateTag();
  const [open, setOpen] = useState(false);
  const [term, setTerm] = useState('');

  const currentIds = current.map((t) => t.id);

  const toggle = async (tagId: string) => {
    const next = currentIds.includes(tagId)
      ? currentIds.filter((id) => id !== tagId)
      : [...currentIds, tagId];
    try {
      await setTags.mutateAsync(next);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  // Neues Tag anlegen und direkt zuweisen — spart den Umweg über
  // die Einstellungen, wenn beim Erfassen ein Begriff fehlt.
  const createAndAssign = async () => {
    const label = term.trim();
    if (!label) return;
    try {
      const tag = await createTag.mutateAsync({ label });
      await setTags.mutateAsync([...currentIds, tag.id]);
      setTerm('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const exactMatch = all.some((t) => t.label.toLowerCase() === term.trim().toLowerCase());

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {current.map((tag) => (
        <Badge
          key={tag.id}
          variant="secondary"
          className={cn('gap-1 font-medium', TONE[tag.color] ?? TONE.slate)}
        >
          {tag.label}
          <button
            type="button"
            onClick={() => void toggle(tag.id)}
            className="opacity-60 hover:opacity-100"
            aria-label={`${tag.label} entfernen`}
          >
            <X className="h-3 w-3" />
          </button>
        </Badge>
      ))}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button variant="ghost" size="sm" className="h-6 gap-1 px-2 text-xs text-muted-foreground">
            <Plus className="h-3 w-3" />
            Tag
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-56 p-0" align="start">
          <Command>
            <CommandInput placeholder="Suchen oder anlegen …" value={term} onValueChange={setTerm} />
            <CommandList>
              {term.trim() && !exactMatch && (
                <CommandEmpty className="p-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-start"
                    onClick={createAndAssign}
                    disabled={createTag.isPending}
                  >
                    <Plus className="mr-2 h-3.5 w-3.5" />
                    „{term.trim()}" anlegen
                  </Button>
                </CommandEmpty>
              )}
              <CommandGroup>
                {all.map((tag) => (
                  <CommandItem key={tag.id} value={tag.label} onSelect={() => void toggle(tag.id)}>
                    <Check
                      className={cn(
                        'mr-2 h-4 w-4',
                        currentIds.includes(tag.id) ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                    {tag.label}
                  </CommandItem>
                ))}
              </CommandGroup>
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>
    </div>
  );
}
