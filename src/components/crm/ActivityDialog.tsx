import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useProfiles } from '@/features/meta/api';
import { useCreateActivity, useUpdateActivity, type Activity } from '@/features/activities/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { EntityCombobox } from '@/components/crm/EntityCombobox';
import { ACTIVITY_OPTIONS } from '@/components/crm/primitives';
import type { ActivityType } from '@/integrations/supabase/types';

/** Verknüpfung, an der die Aufgabe hängt. */
export type ActivityParent = { deal_id?: string; contact_id?: string; company_id?: string };

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  activity?: Activity | null;
  parent?: ActivityParent;
}

/** `datetime-local` erwartet lokale Zeit ohne Zonenangabe. */
function toLocalInput(iso: string | null): string {
  if (!iso) return '';
  return format(new Date(iso), "yyyy-MM-dd'T'HH:mm");
}

function defaultDue(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  d.setHours(9, 0, 0, 0);
  return format(d, "yyyy-MM-dd'T'HH:mm");
}

export function ActivityDialog({ open, onOpenChange, activity, parent }: Props) {
  const { user } = useAuth();
  const { data: profiles = [] } = useProfiles();
  const create = useCreateActivity();
  const update = useUpdateActivity();

  const [type, setType] = useState<ActivityType>('task');
  const [subject, setSubject] = useState('');
  const [notes, setNotes] = useState('');
  const [dueAt, setDueAt] = useState('');
  const [ownerId, setOwnerId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (activity) {
      setType(activity.type);
      setSubject(activity.subject);
      setNotes(activity.notes ?? '');
      setDueAt(toLocalInput(activity.due_at));
      setOwnerId(activity.owner_id);
    } else {
      setType('task');
      setSubject('');
      setNotes('');
      setDueAt(defaultDue());
      setOwnerId(user?.id ?? null);
    }
  }, [open, activity, user?.id]);

  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim()) {
      toast.error('Betreff wird benötigt.');
      return;
    }

    const payload = {
      type,
      subject: subject.trim(),
      notes: notes.trim() || null,
      // Der Browser liefert lokale Zeit; new Date() rechnet sie korrekt in UTC.
      due_at: dueAt ? new Date(dueAt).toISOString() : null,
      owner_id: ownerId,
    };

    try {
      if (activity) {
        await update.mutateAsync({ id: activity.id, ...payload });
        toast.success('Aufgabe gespeichert');
      } else {
        await create.mutateAsync({
          ...payload,
          ...parent,
          done: false,
          created_by: user?.id ?? null,
        });
        toast.success('Aufgabe angelegt');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{activity ? 'Aufgabe bearbeiten' : 'Neue Aufgabe'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Art</Label>
              <Select value={type} onValueChange={(v) => setType(v as ActivityType)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ACTIVITY_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="due">Fällig</Label>
              <Input
                id="due"
                type="datetime-local"
                value={dueAt}
                onChange={(e) => setDueAt(e.target.value)}
                className="h-9"
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="subject">Betreff</Label>
            <Input
              id="subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              autoFocus
              placeholder="z. B. Angebot nachfassen"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="notes">Notiz</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="resize-none"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Zuständig</Label>
            <EntityCombobox
              value={ownerId}
              onChange={setOwnerId}
              options={profiles.map((p) => ({ value: p.id, label: p.full_name ?? p.email }))}
              placeholder="Niemand"
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Abbrechen
            </Button>
            <Button type="submit" disabled={busy}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {activity ? 'Speichern' : 'Anlegen'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
