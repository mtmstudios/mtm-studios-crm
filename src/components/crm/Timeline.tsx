import { useState } from 'react';
import {
  CalendarClock,
  Check,
  Mail,
  MessageSquare,
  Phone,
  Trash2,
  Users,
  Utensils,
} from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { dateRelative, initials } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import {
  useCreateNote,
  useDeleteNote,
  useToggleActivity,
  type TimelineItem,
} from '@/features/activities/api';
import { ACTIVITY_LABEL } from '@/components/crm/primitives';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import type { ActivityType } from '@/integrations/supabase/types';

const ACTIVITY_ICON: Record<ActivityType, React.ComponentType<{ className?: string }>> = {
  call: Phone,
  meeting: Users,
  task: Check,
  email: Mail,
  deadline: CalendarClock,
  lunch: Utensils,
};

export type TimelineParent = { deal_id: string } | { contact_id: string } | { company_id: string };

interface Props {
  items: TimelineItem[];
  loading?: boolean;
  parent: TimelineParent;
}

export function Timeline({ items, loading, parent }: Props) {
  const { user } = useAuth();
  const createNote = useCreateNote();
  const deleteNote = useDeleteNote();
  const toggle = useToggleActivity();
  const [draft, setDraft] = useState('');

  const addNote = async () => {
    const body = draft.trim();
    if (!body) return;
    try {
      await createNote.mutateAsync({ body, ...parent });
      setDraft('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-lg border border-border bg-card p-3">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Notiz hinzufügen …"
          rows={2}
          className="resize-none border-0 p-0 shadow-none focus-visible:ring-0"
          onKeyDown={(e) => {
            // Cmd/Ctrl+Enter speichert — Enter bleibt für Absätze frei
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') void addNote();
          }}
        />
        {draft.trim() && (
          <div className="mt-2 flex items-center justify-end gap-2 border-t border-border pt-2">
            <span className="mr-auto text-xs text-muted-foreground">⌘↵ zum Speichern</span>
            <Button variant="ghost" size="sm" onClick={() => setDraft('')}>
              Verwerfen
            </Button>
            <Button size="sm" onClick={addNote} disabled={createNote.isPending}>
              Speichern
            </Button>
          </div>
        )}
      </div>

      {loading && (
        <div className="space-y-3">
          {[0, 1, 2].map((i) => (
            <Skeleton key={i} className="h-16 w-full" />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <p className="py-8 text-center text-sm text-muted-foreground">
          Noch keine Notizen oder Aufgaben.
        </p>
      )}

      <ol className="relative space-y-3">
        {items.map((item) => {
          if (item.kind === 'note') {
            const { note } = item;
            return (
              <li key={`note-${note.id}`} className="group flex gap-3">
                <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-secondary text-[10px] font-semibold text-secondary-foreground">
                  {initials(note.author?.full_name)}
                </span>
                <div className="min-w-0 flex-1 rounded-lg border border-border bg-card p-3">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <MessageSquare className="h-3.5 w-3.5" />
                    <span className="font-medium text-foreground">
                      {note.author?.full_name ?? 'Unbekannt'}
                    </span>
                    <span>{dateRelative(note.created_at)}</span>
                    {note.created_by === user?.id && (
                      <button
                        type="button"
                        onClick={() => void deleteNote.mutateAsync(note.id)}
                        className="ml-auto opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100"
                        aria-label="Notiz löschen"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-1.5 whitespace-pre-wrap text-sm">{note.body}</p>
                </div>
              </li>
            );
          }

          const { activity } = item;
          const Icon = ACTIVITY_ICON[activity.type];
          const overdue = !activity.done && activity.due_at && new Date(activity.due_at) < new Date();

          return (
            <li key={`act-${activity.id}`} className="flex gap-3">
              <span
                className={cn(
                  'mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full',
                  activity.done
                    ? 'bg-emerald-100 text-emerald-700'
                    : overdue
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-secondary text-muted-foreground',
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </span>
              <div className="min-w-0 flex-1 rounded-lg border border-border bg-card p-3">
                <div className="flex items-start gap-2">
                  <Checkbox
                    checked={activity.done}
                    onCheckedChange={(checked) =>
                      toggle.mutate({ id: activity.id, done: checked === true })
                    }
                    className="mt-0.5"
                    aria-label="Als erledigt markieren"
                  />
                  <div className="min-w-0 flex-1">
                    <div
                      className={cn(
                        'text-sm font-medium',
                        activity.done && 'text-muted-foreground line-through',
                      )}
                    >
                      {activity.subject}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                      <span>{ACTIVITY_LABEL[activity.type]}</span>
                      {activity.due_at && (
                        <>
                          <span>·</span>
                          <span className={cn(overdue && 'font-medium text-destructive')}>
                            {dateRelative(activity.due_at)}
                          </span>
                        </>
                      )}
                      {activity.owner?.full_name && (
                        <>
                          <span>·</span>
                          <span>{activity.owner.full_name}</span>
                        </>
                      )}
                    </div>
                    {activity.notes && (
                      <p className="mt-1.5 whitespace-pre-wrap text-sm text-muted-foreground">
                        {activity.notes}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
