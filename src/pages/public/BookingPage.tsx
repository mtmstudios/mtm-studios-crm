import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { addDays, format, isSameDay } from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarCheck, CheckCircle2, ChevronLeft, ChevronRight, Clock, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { useBookSlot, useBookingSlots, usePublicBookingPage } from '@/features/calendar/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const { data: page, isPending, isError } = usePublicBookingPage(slug);

  const [weekOffset, setWeekOffset] = useState(0);
  const [day, setDay] = useState<Date>(new Date());
  const [slot, setSlot] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [confirmed, setConfirmed] = useState<{ startsAt: string } | null>(null);

  const book = useBookSlot();
  const { data: slots = [], isFetching: slotsLoading } = useBookingSlots(
    slug,
    format(day, 'yyyy-MM-dd'),
  );

  // Tageswechsel verwirft eine bereits getroffene Uhrzeit
  useEffect(() => setSlot(null), [day]);

  const days = Array.from({ length: 7 }, (_, i) => addDays(new Date(), weekOffset * 7 + i));
  const maxOffset = page ? Math.floor(page.horizon_days / 7) : 0;

  if (isPending) {
    return (
      <div className="mx-auto max-w-lg space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (isError || !page) {
    return (
      <div className="grid min-h-screen place-items-center p-6">
        <div className="text-center">
          <h1 className="text-lg font-semibold">Buchungsseite nicht gefunden</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Der Link ist ungültig oder die Seite wurde deaktiviert.
          </p>
        </div>
      </div>
    );
  }

  if (confirmed) {
    return (
      <div className="grid min-h-screen place-items-center bg-surface p-6">
        <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 text-center">
          <CheckCircle2 className="mx-auto h-10 w-10 text-success" />
          <h1 className="mt-3 text-lg font-semibold">Termin bestätigt</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {format(new Date(confirmed.startsAt), "EEEE, d. MMMM yyyy 'um' HH:mm 'Uhr'", {
              locale: de,
            })}
          </p>
          <p className="mt-3 text-sm text-muted-foreground">
            Eine Bestätigung geht an {email}.
          </p>
        </div>
      </div>
    );
  }

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!slot) {
      toast.error('Bitte eine Uhrzeit wählen.');
      return;
    }
    try {
      const result = await book.mutateAsync({
        slug: slug!,
        startsAt: slot,
        name,
        email,
        phone: phone || undefined,
        notes: notes || undefined,
      });
      setConfirmed({ startsAt: (result as { starts_at: string }).starts_at });
    } catch (err) {
      // Der häufigste Fall: jemand war schneller
      toast.error((err as Error).message);
      setSlot(null);
    }
  };

  return (
    <div className="min-h-screen bg-surface px-4 py-8">
      <div className="mx-auto max-w-2xl">
        <header className="mb-6 text-center">
          <h1 className="text-xl font-semibold tracking-tight">{page.title}</h1>
          {page.host_name && (
            <p className="mt-1 text-sm text-muted-foreground">mit {page.host_name}</p>
          )}
          <p className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
            <Clock className="h-4 w-4" />
            {page.duration_minutes} Minuten
          </p>
          {page.description && (
            <p className="mx-auto mt-3 max-w-md text-sm text-muted-foreground">{page.description}</p>
          )}
        </header>

        <div className="rounded-lg border border-border bg-card p-4 sm:p-6">
          {/* Tagesauswahl */}
          <div className="mb-4 flex items-center justify-between gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={weekOffset === 0}
              onClick={() => setWeekOffset((v) => v - 1)}
              aria-label="Frühere Tage"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-sm font-medium">
              {format(days[0], 'd. MMM', { locale: de })} –{' '}
              {format(days[6], 'd. MMM', { locale: de })}
            </span>
            <Button
              variant="outline"
              size="icon"
              className="h-8 w-8"
              disabled={weekOffset >= maxOffset}
              onClick={() => setWeekOffset((v) => v + 1)}
              aria-label="Spätere Tage"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>

          <div className="grid grid-cols-7 gap-1.5">
            {days.map((d) => (
              <button
                key={d.toISOString()}
                type="button"
                onClick={() => setDay(d)}
                className={cn(
                  'rounded-md border px-1 py-2 text-center transition-colors',
                  isSameDay(d, day)
                    ? 'border-primary bg-primary text-primary-foreground'
                    : 'border-border hover:bg-surface-hover',
                )}
              >
                <div className="text-[10px] uppercase tracking-wide opacity-80">
                  {format(d, 'EEEEEE', { locale: de })}
                </div>
                <div className="text-sm font-semibold">{format(d, 'd')}</div>
              </button>
            ))}
          </div>

          {/* Uhrzeiten */}
          <div className="mt-5">
            <h2 className="mb-2 text-sm font-medium">
              {format(day, 'EEEE, d. MMMM', { locale: de })}
            </h2>

            {slotsLoading ? (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {[0, 1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-9 w-full" />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <p className="rounded-md bg-surface py-6 text-center text-sm text-muted-foreground">
                An diesem Tag ist nichts frei.
              </p>
            ) : (
              <div className="grid grid-cols-3 gap-1.5 sm:grid-cols-4">
                {slots.map((iso) => (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => setSlot(iso)}
                    className={cn(
                      'rounded-md border py-2 text-sm font-medium tabular-nums transition-colors',
                      slot === iso
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border hover:border-primary/40 hover:bg-surface-hover',
                    )}
                  >
                    {format(new Date(iso), 'HH:mm')}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Kontaktdaten — erst nach der Zeitwahl, das hält die Seite ruhig */}
          {slot && (
            <form onSubmit={submit} className="mt-6 space-y-3 border-t border-border pt-5">
              <div className="space-y-1.5">
                <Label htmlFor="bname">Name</Label>
                <Input
                  id="bname"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  autoComplete="name"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bemail">E-Mail</Label>
                <Input
                  id="bemail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bphone">Telefon (optional)</Label>
                <Input
                  id="bphone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  autoComplete="tel"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bnotes">Worum geht es? (optional)</Label>
                <Textarea
                  id="bnotes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                  className="resize-none"
                />
              </div>

              <Button type="submit" className="w-full" disabled={book.isPending}>
                {book.isPending ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <CalendarCheck className="mr-2 h-4 w-4" />
                )}
                Termin um {format(new Date(slot), 'HH:mm')} Uhr buchen
              </Button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}
