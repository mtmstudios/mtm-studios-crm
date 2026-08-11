import { useEffect, useState } from 'react';
import { Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { useDebounce } from '@/hooks/useDebounce';
import { useContactOptions } from '@/features/contacts/api';
import { useProfiles } from '@/features/meta/api';
import {
  useCreateAppointment,
  useDeleteAppointment,
  useUpdateAppointment,
  type AppointmentRow,
} from '@/features/calendar/api';
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
import type { ApptStatus } from '@/integrations/supabase/types';

const STATUS_OPTIONS: { value: ApptStatus; label: string }[] = [
  { value: 'scheduled', label: 'Geplant' },
  { value: 'confirmed', label: 'Bestätigt' },
  { value: 'completed', label: 'Erledigt' },
  { value: 'cancelled', label: 'Abgesagt' },
  { value: 'no_show', label: 'Nicht erschienen' },
];

interface Props {
  open: boolean;
  onOpenChange(open: boolean): void;
  appointment?: AppointmentRow | null;
  defaultDay?: Date | null;
}

export function AppointmentDialog({ open, onOpenChange, appointment, defaultDay }: Props) {
  const { user } = useAuth();
  const { data: profiles = [] } = useProfiles();
  const create = useCreateAppointment();
  const update = useUpdateAppointment();
  const remove = useDeleteAppointment();

  const [title, setTitle] = useState('');
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [location, setLocation] = useState('');
  const [notes, setNotes] = useState('');
  const [status, setStatus] = useState<ApptStatus>('scheduled');
  const [contactId, setContactId] = useState<string | null>(null);
  const [ownerId, setOwnerId] = useState<string | null>(null);

  const [contactTerm, setContactTerm] = useState('');
  const { data: contacts = [] } = useContactOptions(useDebounce(contactTerm, 250));

  useEffect(() => {
    if (!open) return;
    if (appointment) {
      setTitle(appointment.title);
      setStartsAt(format(new Date(appointment.starts_at), "yyyy-MM-dd'T'HH:mm"));
      setEndsAt(format(new Date(appointment.ends_at), "yyyy-MM-dd'T'HH:mm"));
      setLocation(appointment.location ?? '');
      setNotes(appointment.notes ?? '');
      setStatus(appointment.status);
      setContactId(appointment.contact_id);
      setOwnerId(appointment.owner_id);
    } else {
      // Vorschlag: am gewählten Tag um 10:00, eine Stunde lang
      const base = defaultDay ? new Date(defaultDay) : new Date();
      base.setHours(10, 0, 0, 0);
      const end = new Date(base.getTime() + 60 * 60_000);
      setTitle('');
      setStartsAt(format(base, "yyyy-MM-dd'T'HH:mm"));
      setEndsAt(format(end, "yyyy-MM-dd'T'HH:mm"));
      setLocation('');
      setNotes('');
      setStatus('scheduled');
      setContactId(null);
      setOwnerId(user?.id ?? null);
    }
  }, [open, appointment, defaultDay, user?.id]);

  // Ende mitziehen, wenn der Start hinter das Ende rutscht
  useEffect(() => {
    if (!startsAt || !endsAt) return;
    if (new Date(endsAt) <= new Date(startsAt)) {
      setEndsAt(format(new Date(new Date(startsAt).getTime() + 60 * 60_000), "yyyy-MM-dd'T'HH:mm"));
    }
  }, [startsAt, endsAt]);

  const busy = create.isPending || update.isPending;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error('Ein Titel wird benötigt.');
      return;
    }

    const payload = {
      title: title.trim(),
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString(),
      location: location.trim() || null,
      notes: notes.trim() || null,
      status,
      contact_id: contactId,
      owner_id: ownerId,
    };

    try {
      if (appointment) {
        await update.mutateAsync({ id: appointment.id, ...payload });
        toast.success('Termin gespeichert');
      } else {
        await create.mutateAsync({ ...payload, created_by: user?.id ?? null });
        toast.success('Termin angelegt');
      }
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const doDelete = async () => {
    if (!appointment) return;
    try {
      await remove.mutateAsync(appointment.id);
      toast.success('Termin gelöscht');
      onOpenChange(false);
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{appointment ? 'Termin bearbeiten' : 'Neuer Termin'}</DialogTitle>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="atitle">Titel</Label>
            <Input
              id="atitle"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              autoFocus
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="start">Beginn</Label>
              <Input
                id="start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="h-9"
                required
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="end">Ende</Label>
              <Input
                id="end"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="h-9"
                required
              />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="location">Ort</Label>
            <Input
              id="location"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Vor Ort, Telefon, Videocall …"
            />
          </div>

          <div className="space-y-1.5">
            <Label>Kontakt</Label>
            <EntityCombobox
              value={contactId}
              onChange={setContactId}
              onSearchChange={setContactTerm}
              options={contacts.map((c) => ({ value: c.id, label: c.full_name, hint: c.email }))}
              placeholder="Kontakt zuordnen …"
            />
          </div>

          {appointment?.guest_name && (
            <div className="rounded-md border border-border bg-surface p-2.5 text-xs">
              <div className="font-medium">Selbst gebucht</div>
              <div className="mt-0.5 text-muted-foreground">
                {appointment.guest_name} · {appointment.guest_email}
                {appointment.guest_phone && ` · ${appointment.guest_phone}`}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as ApptStatus)}>
                <SelectTrigger className="h-9">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="anotes">Notiz</Label>
            <Textarea
              id="anotes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={2}
              className="resize-none"
            />
          </div>

          <DialogFooter className="sm:justify-between">
            {appointment ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-destructive hover:text-destructive"
                onClick={doDelete}
              >
                <Trash2 className="mr-1.5 h-4 w-4" />
                Löschen
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={busy}>
                {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {appointment ? 'Speichern' : 'Anlegen'}
              </Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
