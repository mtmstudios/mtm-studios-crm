import { useEffect, useState } from 'react';
import { Copy, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/useAuth';
import { useBookingSettings, useUpsertBookingSetting } from '@/features/calendar/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';

const DAYS = [
  { key: 'mon', label: 'Mo' },
  { key: 'tue', label: 'Di' },
  { key: 'wed', label: 'Mi' },
  { key: 'thu', label: 'Do' },
  { key: 'fri', label: 'Fr' },
  { key: 'sat', label: 'Sa' },
  { key: 'sun', label: 'So' },
] as const;

type Availability = Record<string, [string, string][]>;

const DEFAULT_AVAILABILITY: Availability = {
  mon: [['09:00', '17:00']],
  tue: [['09:00', '17:00']],
  wed: [['09:00', '17:00']],
  thu: [['09:00', '17:00']],
  fri: [['09:00', '17:00']],
};

/** Aus einem Namen einen URL-tauglichen Slug bauen. */
function slugify(input: string): string {
  return input
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export default function BookingSettings() {
  const { profile } = useAuth();
  const { data: pages = [], isPending } = useBookingSettings(profile?.id);
  const upsert = useUpsertBookingSetting();

  const existing = pages[0];

  const [slug, setSlug] = useState('');
  const [title, setTitle] = useState('Erstgespräch');
  const [description, setDescription] = useState('');
  const [duration, setDuration] = useState(30);
  const [buffer, setBuffer] = useState(0);
  const [leadTime, setLeadTime] = useState(12);
  const [horizon, setHorizon] = useState(30);
  const [isActive, setIsActive] = useState(true);
  const [availability, setAvailability] = useState<Availability>(DEFAULT_AVAILABILITY);

  useEffect(() => {
    if (!existing) {
      // Vorschlag aus dem eigenen Namen, solange nichts eingerichtet ist
      if (profile?.full_name) setSlug(slugify(profile.full_name));
      return;
    }
    setSlug(existing.slug);
    setTitle(existing.title);
    setDescription(existing.description ?? '');
    setDuration(existing.duration_minutes);
    setBuffer(existing.buffer_minutes);
    setLeadTime(existing.lead_time_hours);
    setHorizon(existing.horizon_days);
    setIsActive(existing.is_active);
    setAvailability((existing.availability as Availability) ?? DEFAULT_AVAILABILITY);
  }, [existing, profile?.full_name]);

  if (isPending) return <Skeleton className="h-96 w-full max-w-2xl" />;

  const url = `${window.location.origin}/termin/${slug}`;

  const toggleDay = (key: string, on: boolean) => {
    setAvailability((prev) => {
      const next = { ...prev };
      if (on) next[key] = [['09:00', '17:00']];
      else delete next[key];
      return next;
    });
  };

  const setWindow = (key: string, index: 0 | 1, value: string) => {
    setAvailability((prev) => {
      const window = prev[key]?.[0] ?? ['09:00', '17:00'];
      const updated: [string, string] = [...window] as [string, string];
      updated[index] = value;
      return { ...prev, [key]: [updated] };
    });
  };

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;

    const clean = slugify(slug);
    if (!clean) {
      toast.error('Bitte eine gültige Adresse für den Link angeben.');
      return;
    }

    try {
      await upsert.mutateAsync({
        ...(existing ? { id: existing.id } : {}),
        owner_id: profile.id,
        slug: clean,
        title: title.trim(),
        description: description.trim() || null,
        duration_minutes: duration,
        buffer_minutes: buffer,
        lead_time_hours: leadTime,
        horizon_days: horizon,
        is_active: isActive,
        availability,
      });
      setSlug(clean);
      toast.success('Buchungsseite gespeichert');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  return (
    <form onSubmit={save} className="max-w-2xl space-y-6">
      <div>
        <h2 className="text-sm font-semibold">Buchungsseite</h2>
        <p className="text-sm text-muted-foreground">
          Interessenten wählen selbst eine freie Zeit. Bereits belegte Termine werden
          automatisch ausgeblendet.
        </p>
      </div>

      <div className="space-y-4 rounded-lg border border-border p-4">
        <div className="flex items-center justify-between">
          <div>
            <Label htmlFor="active">Seite aktiv</Label>
            <p className="text-xs text-muted-foreground">
              Deaktiviert zeigt der Link einen Hinweis statt freier Zeiten.
            </p>
          </div>
          <Switch id="active" checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="slug">Link</Label>
          <div className="flex gap-2">
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="font-mono text-sm"
            />
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 shrink-0"
              onClick={() => {
                void navigator.clipboard.writeText(url);
                toast.success('Link kopiert');
              }}
              aria-label="Link kopieren"
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <p className="truncate text-xs text-muted-foreground">{url}</p>
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="btitle">Titel</Label>
          <Input id="btitle" value={title} onChange={(e) => setTitle(e.target.value)} required />
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="bdesc">Beschreibung</Label>
          <Textarea
            id="bdesc"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
            className="resize-none"
            placeholder="Was passiert in diesem Termin?"
          />
        </div>
      </div>

      <div className="grid gap-4 rounded-lg border border-border p-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="duration">Dauer (Minuten)</Label>
          <Input
            id="duration"
            type="number"
            min={5}
            step={5}
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="buffer">Puffer danach (Minuten)</Label>
          <Input
            id="buffer"
            type="number"
            min={0}
            step={5}
            value={buffer}
            onChange={(e) => setBuffer(Number(e.target.value))}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="lead">Vorlaufzeit (Stunden)</Label>
          <Input
            id="lead"
            type="number"
            min={0}
            value={leadTime}
            onChange={(e) => setLeadTime(Number(e.target.value))}
          />
          <p className="text-xs text-muted-foreground">Frühestens so weit im Voraus buchbar.</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="horizon">Vorausschau (Tage)</Label>
          <Input
            id="horizon"
            type="number"
            min={1}
            value={horizon}
            onChange={(e) => setHorizon(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="space-y-3 rounded-lg border border-border p-4">
        <Label>Verfügbarkeit</Label>
        {DAYS.map((day) => {
          const window = availability[day.key];
          const on = !!window;
          return (
            <div key={day.key} className="flex items-center gap-3">
              <Switch
                checked={on}
                onCheckedChange={(checked) => toggleDay(day.key, checked)}
                aria-label={day.label}
              />
              <span className="w-8 text-sm font-medium">{day.label}</span>
              {on ? (
                <div className="flex items-center gap-2">
                  <Input
                    type="time"
                    value={window[0][0]}
                    onChange={(e) => setWindow(day.key, 0, e.target.value)}
                    className="h-8 w-[110px]"
                  />
                  <span className="text-muted-foreground">–</span>
                  <Input
                    type="time"
                    value={window[0][1]}
                    onChange={(e) => setWindow(day.key, 1, e.target.value)}
                    className="h-8 w-[110px]"
                  />
                </div>
              ) : (
                <span className="text-sm text-muted-foreground">nicht verfügbar</span>
              )}
            </div>
          );
        })}
      </div>

      <Button type="submit" disabled={upsert.isPending}>
        {upsert.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Speichern
      </Button>
    </form>
  );
}
