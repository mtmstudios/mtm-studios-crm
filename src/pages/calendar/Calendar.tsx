import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  addDays,
  eachDayOfInterval,
  endOfWeek,
  format,
  isToday,
  startOfWeek,
} from 'date-fns';
import { de } from 'date-fns/locale';
import { CalendarDays, ChevronLeft, ChevronRight, Link2, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { time } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { useProfiles } from '@/features/meta/api';
import { useAppointments, useBookingSettings, type AppointmentRow } from '@/features/calendar/api';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader, StatusBadge } from '@/components/crm/primitives';
import { AppointmentDialog } from './AppointmentDialog';

export default function Calendar() {
  const { profile } = useAuth();
  const { data: profiles = [] } = useProfiles();
  const { data: bookingPages = [] } = useBookingSettings(profile?.id);

  const [anchor, setAnchor] = useState(new Date());
  const [scope, setScope] = useState<string>('team');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<AppointmentRow | null>(null);
  const [prefillDay, setPrefillDay] = useState<Date | null>(null);

  // Woche beginnt in Deutschland am Montag
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(anchor, { weekStartsOn: 1 });
  const days = useMemo(
    () => eachDayOfInterval({ start: weekStart, end: weekEnd }),
    [weekStart, weekEnd],
  );

  const ownerId = scope === 'team' ? null : scope;
  const { data: appointments = [], isPending } = useAppointments(weekStart, weekEnd, ownerId);

  const byDay = useMemo(() => {
    const map = new Map<string, AppointmentRow[]>();
    for (const day of days) map.set(format(day, 'yyyy-MM-dd'), []);
    for (const appointment of appointments) {
      const key = format(new Date(appointment.starts_at), 'yyyy-MM-dd');
      map.get(key)?.push(appointment);
    }
    return map;
  }, [appointments, days]);

  const openNew = (day: Date) => {
    setEditing(null);
    setPrefillDay(day);
    setDialogOpen(true);
  };

  const copyLink = async (slug: string) => {
    const url = `${window.location.origin}/termin/${slug}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success('Buchungslink kopiert');
    } catch {
      // clipboard schlägt ohne sicheren Kontext fehl — dann den Link zeigen
      toast.info(url);
    }
  };

  return (
    <>
      <PageHeader
        title="Kalender"
        subtitle={`${format(weekStart, 'd. MMM', { locale: de })} – ${format(weekEnd, 'd. MMM yyyy', { locale: de })}`}
      >
        {bookingPages.map((page) => (
          <Button key={page.id} variant="outline" size="sm" onClick={() => copyLink(page.slug)}>
            <Link2 className="mr-1.5 h-4 w-4" />
            Buchungslink
          </Button>
        ))}
        <Button size="sm" onClick={() => openNew(new Date())}>
          <Plus className="mr-1.5 h-4 w-4" />
          Termin
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-1">
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setAnchor(addDays(anchor, -7))}
            aria-label="Vorherige Woche"
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="h-9" onClick={() => setAnchor(new Date())}>
            Heute
          </Button>
          <Button
            variant="outline"
            size="icon"
            className="h-9 w-9"
            onClick={() => setAnchor(addDays(anchor, 7))}
            aria-label="Nächste Woche"
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="h-9 w-[170px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="team">Ganzes Team</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="scrollbar-slim overflow-x-auto px-4 pb-6 sm:px-6">
        <div className="grid min-w-[900px] grid-cols-7 gap-2">
          {days.map((day) => {
            const key = format(day, 'yyyy-MM-dd');
            const items = byDay.get(key) ?? [];
            const today = isToday(day);

            return (
              <div key={key} className="flex min-h-[420px] flex-col">
                <div
                  className={cn(
                    'mb-2 rounded-md px-2 py-1.5 text-center',
                    today ? 'bg-primary text-primary-foreground' : 'bg-surface',
                  )}
                >
                  <div className="text-[11px] uppercase tracking-wide opacity-80">
                    {format(day, 'EEEEEE', { locale: de })}
                  </div>
                  <div className="text-sm font-semibold">{format(day, 'd')}</div>
                </div>

                <button
                  type="button"
                  onClick={() => openNew(day)}
                  className="mb-2 rounded-md border border-dashed border-border py-1 text-xs text-muted-foreground transition-colors hover:border-primary/40 hover:text-foreground"
                >
                  <Plus className="mr-1 inline h-3 w-3" />
                  Termin
                </button>

                <div className="flex-1 space-y-1.5">
                  {isPending && <Skeleton className="h-16 w-full" />}

                  {!isPending && items.length === 0 && (
                    <p className="pt-4 text-center text-xs text-muted-foreground">—</p>
                  )}

                  {items.map((appointment) => (
                    <button
                      key={appointment.id}
                      type="button"
                      onClick={() => {
                        setEditing(appointment);
                        setPrefillDay(null);
                        setDialogOpen(true);
                      }}
                      className={cn(
                        'w-full rounded-md border-l-2 bg-card p-2 text-left shadow-sm transition-shadow hover:shadow-md',
                        appointment.status === 'cancelled'
                          ? 'border-l-destructive opacity-60'
                          : 'border-l-primary',
                      )}
                    >
                      <div className="text-[11px] font-medium tabular-nums text-muted-foreground">
                        {time(appointment.starts_at)}–{time(appointment.ends_at)}
                      </div>
                      <div className="mt-0.5 line-clamp-2 text-xs font-medium">
                        {appointment.title}
                      </div>
                      {(appointment.contacts || appointment.guest_name) && (
                        <div className="mt-0.5 truncate text-[11px] text-muted-foreground">
                          {appointment.contacts?.full_name ?? appointment.guest_name}
                        </div>
                      )}
                      {appointment.status !== 'scheduled' && (
                        <div className="mt-1">
                          <StatusBadge kind="appointment" value={appointment.status} />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {bookingPages.length === 0 && (
        <div className="mx-4 mb-6 rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground sm:mx-6">
          <CalendarDays className="mr-1.5 inline h-4 w-4" />
          Noch keine Buchungsseite eingerichtet.{' '}
          <Link to="/einstellungen/buchung" className="text-primary hover:underline">
            Jetzt anlegen
          </Link>{' '}
          — dann können Interessenten selbst Termine wählen.
        </div>
      )}

      <AppointmentDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        appointment={editing}
        defaultDay={prefillDay}
      />
    </>
  );
}
