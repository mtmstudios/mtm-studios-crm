import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/crm/EmptyState";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { toast } from "sonner";
import { Plus, Calendar, ChevronLeft, ChevronRight, Clock, Link2, Settings } from "lucide-react";
import { format, startOfMonth, endOfMonth, startOfWeek, endOfWeek, addDays, addMonths, subMonths, isSameMonth, isSameDay, isToday, setHours, setMinutes } from "date-fns";
import { de } from "date-fns/locale";

type ViewMode = "month" | "week" | "day";

export default function Appointments() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [currentDate, setCurrentDate] = useState(new Date());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);

  const { data: appointments = [] } = useQuery({
    queryKey: ["appointments"],
    queryFn: async () => {
      const { data, error } = await supabase.from("appointments").select("*, contacts(first_name, last_name)").order("start_time");
      if (error) throw error;
      return data || [];
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["booking-settings"],
    queryFn: async () => {
      const { data } = await supabase.from("booking_settings").select("*").maybeSingle();
      return data;
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-select"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name");
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const startDate = formData.get("date") as string;
      const startTime = formData.get("start_time") as string;
      const endTime = formData.get("end_time") as string;
      const { error } = await supabase.from("appointments").insert({
        title: formData.get("title") as string,
        start_time: `${startDate}T${startTime}:00`,
        end_time: `${startDate}T${endTime}:00`,
        contact_id: (formData.get("contact_id") as string) || null,
        notes: (formData.get("notes") as string) || null,
        owner_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Termin erstellt");
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const saveSettingsMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const slug = (formData.get("slug") as string)?.trim() || null;
      const payload = {
        owner_id: user!.id,
        slot_duration: Number(formData.get("slot_duration")) || 30,
        start_hour: Number(formData.get("start_hour")) || 9,
        end_hour: Number(formData.get("end_hour")) || 17,
        booking_page_slug: slug,
        booking_page_title: (formData.get("title") as string) || "Termin buchen",
        booking_page_description: (formData.get("description") as string) || "",
      };
      if (settings?.id) {
        const { error } = await supabase.from("booking_settings").update(payload).eq("id", settings.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("booking_settings").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["booking-settings"] });
      toast.success("Einstellungen gespeichert");
      setSettingsOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const statusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase.from("appointments").update({ status: status as any }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["appointments"] });
      toast.success("Status aktualisiert");
    },
  });

  // Calendar helpers
  const navigate = (dir: number) => {
    if (viewMode === "month") setCurrentDate(dir > 0 ? addMonths(currentDate, 1) : subMonths(currentDate, 1));
    else if (viewMode === "week") setCurrentDate(addDays(currentDate, dir * 7));
    else setCurrentDate(addDays(currentDate, dir));
  };

  const getMonthDays = () => {
    const start = startOfWeek(startOfMonth(currentDate), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(currentDate), { weekStartsOn: 1 });
    const days: Date[] = [];
    let d = start;
    while (d <= end) { days.push(d); d = addDays(d, 1); }
    return days;
  };

  const getWeekDays = () => {
    const start = startOfWeek(currentDate, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  };

  const getAppointmentsForDay = (day: Date) =>
    appointments.filter((a) => isSameDay(new Date(a.start_time), day));

  const bookingUrl = settings?.booking_page_slug
    ? `${window.location.origin}/book/${settings.booking_page_slug}`
    : null;

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">Termine</h1>
        <div className="flex items-center gap-2">
          {bookingUrl && (
            <Button variant="outline" size="sm" className="border-border text-xs" onClick={() => { navigator.clipboard.writeText(bookingUrl); toast.success("Buchungslink kopiert"); }}>
              <Link2 className="h-3.5 w-3.5 mr-1" /> Buchungslink
            </Button>
          )}
          <Button variant="outline" size="sm" className="border-border" onClick={() => setSettingsOpen(true)}>
            <Settings className="h-3.5 w-3.5" />
          </Button>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md" size="sm">
                <Plus className="h-4 w-4 mr-1" /> Neuer Termin
              </Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
              <DialogHeader><DialogTitle className="text-foreground">Neuer Termin</DialogTitle></DialogHeader>
              <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
                <div><Label className="text-secondary-foreground">Titel</Label><Input name="title" required className="bg-surface border-border rounded-md" placeholder="z.B. Beratungsgespräch" /></div>
                <div><Label className="text-secondary-foreground">Datum</Label><Input name="date" type="date" required defaultValue={selectedDate ? format(selectedDate, "yyyy-MM-dd") : format(new Date(), "yyyy-MM-dd")} className="bg-surface border-border rounded-md" /></div>
                <div className="grid grid-cols-2 gap-3">
                  <div><Label className="text-secondary-foreground">Von</Label><Input name="start_time" type="time" required defaultValue="09:00" className="bg-surface border-border rounded-md" /></div>
                  <div><Label className="text-secondary-foreground">Bis</Label><Input name="end_time" type="time" required defaultValue="09:30" className="bg-surface border-border rounded-md" /></div>
                </div>
                <div><Label className="text-secondary-foreground">Kontakt</Label>
                  <Select name="contact_id">
                    <SelectTrigger className="bg-surface border-border rounded-md"><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {contacts.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-secondary-foreground">Notizen</Label><Textarea name="notes" className="bg-surface border-border rounded-md" placeholder="Optional" /></div>
                <Button type="submit" disabled={createMutation.isPending} className="w-full bg-primary text-primary-foreground rounded-md">
                  {createMutation.isPending ? "Wird erstellt..." : "Termin erstellen"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* View switcher + navigation */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2">
        <div className="flex items-center gap-1 sm:gap-2">
          <Button variant="outline" size="icon" className="h-8 w-8 border-border" onClick={() => navigate(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <h2 className="text-xs sm:text-sm font-medium text-foreground min-w-[100px] sm:min-w-[140px] text-center">
            {viewMode === "month" && format(currentDate, "MMMM yyyy", { locale: de })}
            {viewMode === "week" && `KW ${format(currentDate, "w", { locale: de })} – ${format(currentDate, "MMM yyyy", { locale: de })}`}
            {viewMode === "day" && format(currentDate, "EEEE, d. MMMM", { locale: de })}
          </h2>
          <Button variant="outline" size="icon" className="h-8 w-8 border-border" onClick={() => navigate(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="text-xs text-muted-foreground" onClick={() => setCurrentDate(new Date())}>Heute</Button>
        </div>
        <div className="flex bg-surface rounded-md border border-border">
          {(["month", "week", "day"] as ViewMode[]).map((v) => (
            <button key={v} onClick={() => setViewMode(v)} className={`px-2.5 sm:px-3 py-1.5 text-xs font-medium transition-colors ${viewMode === v ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"} ${v === "month" ? "rounded-l-md" : v === "day" ? "rounded-r-md" : ""}`}>
              {v === "month" ? "Monat" : v === "week" ? "Woche" : "Tag"}
            </button>
          ))}
        </div>
      </div>

      {/* Month view */}
      {viewMode === "month" && (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"].map((d) => (
              <div key={d} className="p-2 text-center text-xs font-medium text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {getMonthDays().map((day, i) => {
              const dayAppts = getAppointmentsForDay(day);
              const isCurrentMonth = isSameMonth(day, currentDate);
              return (
                <div
                  key={i}
                  onClick={() => { setSelectedDate(day); setDialogOpen(true); }}
                  className={`min-h-[60px] sm:min-h-[80px] p-1 border-b border-r border-border cursor-pointer hover:bg-surface/50 transition-colors ${!isCurrentMonth ? "opacity-30" : ""}`}
                >
                  <span className={`text-xs font-medium block text-right mb-0.5 ${isToday(day) ? "bg-primary text-primary-foreground w-5 h-5 rounded-full flex items-center justify-center ml-auto" : "text-foreground"}`}>
                    {format(day, "d")}
                  </span>
                  {dayAppts.slice(0, 2).map((a) => (
                    <div key={a.id} className={`text-[10px] px-1 py-0.5 rounded mb-0.5 truncate ${a.status === "cancelled" ? "bg-destructive/10 text-destructive line-through" : "bg-primary/10 text-primary"}`}>
                      {format(new Date(a.start_time), "HH:mm")} {a.title}
                    </div>
                  ))}
                  {dayAppts.length > 2 && <p className="text-[10px] text-muted-foreground">+{dayAppts.length - 2} mehr</p>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Week view */}
      {viewMode === "week" && (
        <div className="bg-card rounded-lg border border-border overflow-x-auto">
          <div className="grid grid-cols-7 min-w-[600px]">
            {getWeekDays().map((day, i) => {
              const dayAppts = getAppointmentsForDay(day);
              return (
                <div key={i} className="border-r border-border last:border-r-0">
                  <div className={`p-2 border-b border-border text-center ${isToday(day) ? "bg-primary/10" : ""}`}>
                    <p className="text-xs text-muted-foreground">{format(day, "EEE", { locale: de })}</p>
                    <p className={`text-sm font-medium ${isToday(day) ? "text-primary" : "text-foreground"}`}>{format(day, "d")}</p>
                  </div>
                  <div className="p-1 min-h-[200px] space-y-1">
                    {dayAppts.map((a) => (
                      <div key={a.id} className={`text-xs p-1.5 rounded ${a.status === "cancelled" ? "bg-destructive/10 text-destructive" : "bg-primary/10 text-primary"}`}>
                        <p className="font-medium truncate">{a.title}</p>
                        <p className="text-[10px] opacity-70">{format(new Date(a.start_time), "HH:mm")} – {format(new Date(a.end_time), "HH:mm")}</p>
                      </div>
                    ))}
                    <button onClick={() => { setSelectedDate(day); setDialogOpen(true); }} className="w-full text-[10px] text-muted-foreground hover:text-primary py-1">+ Termin</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Day view */}
      {viewMode === "day" && (
        <div className="bg-card rounded-lg border border-border">
          <div className="p-3 border-b border-border">
            <p className="text-sm font-medium text-foreground">{format(currentDate, "EEEE, d. MMMM yyyy", { locale: de })}</p>
          </div>
          <div className="divide-y divide-border">
            {Array.from({ length: 12 }, (_, i) => i + 7).map((hour) => {
              const hourAppts = appointments.filter((a) => {
                const h = new Date(a.start_time).getHours();
                return isSameDay(new Date(a.start_time), currentDate) && h === hour;
              });
              return (
                <div key={hour} className="flex min-h-[48px]">
                  <div className="w-14 shrink-0 p-2 text-right text-xs text-muted-foreground border-r border-border">
                    {String(hour).padStart(2, "0")}:00
                  </div>
                  <div className="flex-1 p-1 space-y-1">
                    {hourAppts.map((a) => (
                      <div key={a.id} className="flex items-center justify-between bg-primary/10 rounded p-2">
                        <div>
                          <p className="text-sm text-primary font-medium">{a.title}</p>
                          <p className="text-xs text-muted-foreground">{format(new Date(a.start_time), "HH:mm")} – {format(new Date(a.end_time), "HH:mm")}</p>
                          {a.contact_name && <p className="text-xs text-secondary-foreground">{a.contact_name}</p>}
                        </div>
                        {a.status === "scheduled" && (
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="text-xs h-6" onClick={() => statusMutation.mutate({ id: a.id, status: "completed" })}>✓</Button>
                            <Button size="sm" variant="ghost" className="text-xs h-6 text-destructive" onClick={() => statusMutation.mutate({ id: a.id, status: "cancelled" })}>✕</Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Upcoming appointments list (below calendar on mobile) */}
      <div className="bg-card rounded-lg border border-border p-4">
        <h3 className="text-sm font-medium text-foreground mb-3">Anstehende Termine</h3>
        {appointments.filter((a) => a.status === "scheduled" && new Date(a.start_time) >= new Date()).length === 0 ? (
          <p className="text-xs text-muted-foreground">Keine anstehenden Termine</p>
        ) : (
          <div className="space-y-2">
            {appointments
              .filter((a) => a.status === "scheduled" && new Date(a.start_time) >= new Date())
              .slice(0, 5)
              .map((a) => (
                <div key={a.id} className="flex items-center gap-3 p-2 rounded-lg bg-surface border border-border">
                  <Clock className="h-4 w-4 text-primary shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{a.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(a.start_time), "dd.MM.yyyy HH:mm", { locale: de })}
                      {a.contact_name && ` – ${a.contact_name}`}
                      {a.contacts && ` – ${(a.contacts as any).first_name} ${(a.contacts as any).last_name}`}
                    </p>
                  </div>
                  <StatusBadge status={a.status} />
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Settings Dialog */}
      <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="text-foreground">Buchungseinstellungen</DialogTitle></DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); saveSettingsMutation.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
            <div><Label className="text-secondary-foreground">Buchungsseiten-URL (Slug)</Label><Input name="slug" defaultValue={settings?.booking_page_slug || ""} placeholder="mein-kalender" className="bg-surface border-border rounded-md" />
              <p className="text-xs text-muted-foreground mt-1">{window.location.origin}/book/<span className="text-primary">{settings?.booking_page_slug || "slug"}</span></p>
            </div>
            <div><Label className="text-secondary-foreground">Seitentitel</Label><Input name="title" defaultValue={settings?.booking_page_title || "Termin buchen"} className="bg-surface border-border rounded-md" /></div>
            <div><Label className="text-secondary-foreground">Beschreibung</Label><Textarea name="description" defaultValue={settings?.booking_page_description || ""} className="bg-surface border-border rounded-md" /></div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div><Label className="text-secondary-foreground">Slot-Dauer (Min)</Label><Input name="slot_duration" type="number" defaultValue={settings?.slot_duration || 30} className="bg-surface border-border rounded-md" /></div>
              <div><Label className="text-secondary-foreground">Von (Uhr)</Label><Input name="start_hour" type="number" min="0" max="23" defaultValue={settings?.start_hour || 9} className="bg-surface border-border rounded-md" /></div>
              <div><Label className="text-secondary-foreground">Bis (Uhr)</Label><Input name="end_hour" type="number" min="0" max="23" defaultValue={settings?.end_hour || 17} className="bg-surface border-border rounded-md" /></div>
            </div>
            <Button type="submit" disabled={saveSettingsMutation.isPending} className="w-full bg-primary text-primary-foreground rounded-md">
              {saveSettingsMutation.isPending ? "Wird gespeichert..." : "Einstellungen speichern"}
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
