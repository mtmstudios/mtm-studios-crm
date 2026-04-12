import { useState } from "react";
import { useParams } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Calendar, Clock, CheckCircle2 } from "lucide-react";
import { format, addDays, isSameDay, startOfDay, setHours, setMinutes } from "date-fns";
import { de } from "date-fns/locale";

export default function BookingPage() {
  const { slug } = useParams<{ slug: string }>();
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<string | null>(null);
  const [booked, setBooked] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");

  const { data: settings, isLoading } = useQuery({
    queryKey: ["public-booking", slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("booking_settings")
        .select("*")
        .eq("booking_page_slug", slug!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: existingAppointments = [] } = useQuery({
    queryKey: ["public-appointments", settings?.owner_id, selectedDate],
    enabled: !!settings?.owner_id && !!selectedDate,
    queryFn: async () => {
      const dayStr = format(selectedDate!, "yyyy-MM-dd");
      const { data } = await supabase
        .from("appointments")
        .select("start_time, end_time")
        .eq("owner_id", settings!.owner_id)
        .eq("status", "scheduled" as any)
        .gte("start_time", `${dayStr}T00:00:00`)
        .lte("start_time", `${dayStr}T23:59:59`);
      return data || [];
    },
  });

  const bookMutation = useMutation({
    mutationFn: async () => {
      if (!settings || !selectedDate || !selectedSlot) return;
      const [h, m] = selectedSlot.split(":").map(Number);
      const start = setMinutes(setHours(selectedDate, h), m);
      const end = new Date(start.getTime() + (settings.slot_duration || 30) * 60000);

      const { error } = await supabase.from("appointments").insert({
        owner_id: settings.owner_id,
        title: `Buchung: ${name}`,
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        contact_name: name,
        contact_email: email,
        contact_phone: phone || null,
        status: "scheduled" as any,
      });
      if (error) throw error;
    },
    onSuccess: () => setBooked(true),
    onError: (e: any) => toast.error(e.message || "Buchung fehlgeschlagen"),
  });

  if (isLoading) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Laden...</p></div>;
  if (!settings) return <div className="min-h-screen flex items-center justify-center bg-background"><p className="text-muted-foreground">Buchungsseite nicht gefunden.</p></div>;

  if (booked) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="bg-card rounded-lg border border-border p-8 max-w-sm text-center">
          <CheckCircle2 className="h-12 w-12 text-primary mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-foreground mb-2">Termin gebucht!</h2>
          <p className="text-sm text-muted-foreground">
            {format(selectedDate!, "dd.MM.yyyy", { locale: de })} um {selectedSlot} Uhr
          </p>
          <p className="text-xs text-muted-foreground mt-2">Eine Bestätigung wird an {email} gesendet.</p>
        </div>
      </div>
    );
  }

  // Generate next 14 days
  const availableDays = Array.from({ length: 14 }, (_, i) => addDays(new Date(), i + 1))
    .filter((d) => (settings.available_days || [1, 2, 3, 4, 5]).includes(d.getDay() === 0 ? 7 : d.getDay()));

  // Generate time slots
  const getSlots = () => {
    if (!selectedDate) return [];
    const slots: string[] = [];
    const duration = settings.slot_duration || 30;
    const startH = settings.start_hour || 9;
    const endH = settings.end_hour || 17;

    for (let h = startH; h < endH; h++) {
      for (let m = 0; m < 60; m += duration) {
        if (h === endH - 1 && m + duration > 60) break;
        const slot = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
        // Check if already booked
        const slotStart = setMinutes(setHours(selectedDate, h), m);
        const slotEnd = new Date(slotStart.getTime() + duration * 60000);
        const isBooked = existingAppointments.some((a) => {
          const aStart = new Date(a.start_time);
          const aEnd = new Date(a.end_time);
          return slotStart < aEnd && slotEnd > aStart;
        });
        if (!isBooked) slots.push(slot);
      }
    }
    return slots;
  };

  return (
    <div className="min-h-screen bg-background p-4 flex items-start justify-center pt-8 sm:pt-16">
      <div className="w-full max-w-lg">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-foreground">{settings.booking_page_title}</h1>
          {settings.booking_page_description && (
            <p className="text-sm text-muted-foreground mt-1">{settings.booking_page_description}</p>
          )}
        </div>

        {/* Step 1: Select date */}
        <div className="bg-card rounded-lg border border-border p-4 mb-4">
          <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-primary" /> Datum wählen
          </h3>
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
            {availableDays.map((day) => (
              <button
                key={day.toISOString()}
                onClick={() => { setSelectedDate(day); setSelectedSlot(null); }}
                className={`p-2 rounded-md border text-center transition-colors ${
                  selectedDate && isSameDay(day, selectedDate)
                    ? "border-primary bg-primary/10 text-primary"
                    : "border-border text-foreground hover:border-primary/40"
                }`}
              >
                <p className="text-xs text-muted-foreground">{format(day, "EEE", { locale: de })}</p>
                <p className="text-sm font-medium">{format(day, "d. MMM", { locale: de })}</p>
              </button>
            ))}
          </div>
        </div>

        {/* Step 2: Select time */}
        {selectedDate && (
          <div className="bg-card rounded-lg border border-border p-4 mb-4">
            <h3 className="text-sm font-medium text-foreground mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4 text-primary" /> Uhrzeit wählen
            </h3>
            {getSlots().length === 0 ? (
              <p className="text-xs text-muted-foreground">Keine freien Termine an diesem Tag.</p>
            ) : (
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
                {getSlots().map((slot) => (
                  <button
                    key={slot}
                    onClick={() => setSelectedSlot(slot)}
                    className={`p-2 rounded-md border text-sm font-medium transition-colors ${
                      selectedSlot === slot
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-border text-foreground hover:border-primary/40"
                    }`}
                  >
                    {slot}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Step 3: Contact info */}
        {selectedSlot && (
          <div className="bg-card rounded-lg border border-border p-4">
            <h3 className="text-sm font-medium text-foreground mb-3">Ihre Daten</h3>
            <div className="space-y-3">
              <div><Label className="text-secondary-foreground">Name *</Label><Input value={name} onChange={(e) => setName(e.target.value)} required className="bg-surface border-border rounded-md" /></div>
              <div><Label className="text-secondary-foreground">E-Mail *</Label><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className="bg-surface border-border rounded-md" /></div>
              <div><Label className="text-secondary-foreground">Telefon</Label><Input value={phone} onChange={(e) => setPhone(e.target.value)} className="bg-surface border-border rounded-md" /></div>
              <Button
                onClick={() => bookMutation.mutate()}
                disabled={bookMutation.isPending || !name.trim() || !email.trim()}
                className="w-full bg-primary text-primary-foreground rounded-md"
              >
                {bookMutation.isPending ? "Wird gebucht..." : "Termin buchen"}
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
