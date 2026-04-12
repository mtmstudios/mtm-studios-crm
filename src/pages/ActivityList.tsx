import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { EmptyState } from "@/components/crm/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, CalendarCheck, Phone, Mail, Calendar, FileText, CheckCircle } from "lucide-react";
import { format, isToday, isBefore } from "date-fns";
import { de } from "date-fns/locale";

const typeIcons: Record<string, any> = { call: Phone, email: Mail, meeting: Calendar, task: CalendarCheck, note: FileText };
const typeLabels: Record<string, string> = { call: "Anruf", email: "E-Mail", meeting: "Meeting", task: "Aufgabe", note: "Notiz" };

export default function ActivityList() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [tab, setTab] = useState("all");

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-select"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name");
      return data || [];
    },
  });

  const { data: dealOptions = [] } = useQuery({
    queryKey: ["deals-select"],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("id, title");
      return data || [];
    },
  });

  const { data: activities = [], isLoading } = useQuery({
    queryKey: ["activities"],
    queryFn: async () => {
      const { data, error } = await supabase.from("activities").select("*, contacts(first_name, last_name), deals(title)").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { error } = await supabase.from("activities").insert({
        type: formData.get("type") as any,
        title: formData.get("title") as string,
        description: formData.get("description") as string || null,
        due_date: formData.get("due_date") ? new Date(formData.get("due_date") as string).toISOString() : null,
        contact_id: formData.get("contact_id") as string || null,
        deal_id: formData.get("deal_id") as string || null,
        owner_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Aktivität erstellt");
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const completeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("activities").update({ completed_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      toast.success("Aktivität abgeschlossen");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const now = new Date();
  const filtered = activities.filter((a: any) => {
    if (tab === "today") return a.due_date && isToday(new Date(a.due_date)) && !a.completed_at;
    if (tab === "overdue") return a.due_date && isBefore(new Date(a.due_date), now) && !a.completed_at;
    if (tab === "completed") return !!a.completed_at;
    return true;
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Aktivitäten</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md"><Plus className="h-4 w-4 mr-1" /> Aktivität hinzufügen</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-foreground">Neue Aktivität</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
              <div><Label className="text-secondary-foreground">Typ</Label>
                <Select name="type" defaultValue="call">
                  <SelectTrigger className="bg-surface border-border rounded-md"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {Object.entries(typeLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-secondary-foreground">Titel</Label><Input name="title" required className="bg-surface border-border rounded-md" /></div>
              <div><Label className="text-secondary-foreground">Beschreibung</Label><Textarea name="description" className="bg-surface border-border rounded-md" /></div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div><Label className="text-secondary-foreground">Kontakt</Label>
                  <Select name="contact_id">
                    <SelectTrigger className="bg-surface border-border rounded-md"><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {contacts.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div><Label className="text-secondary-foreground">Deal</Label>
                  <Select name="deal_id">
                    <SelectTrigger className="bg-surface border-border rounded-md"><SelectValue placeholder="Optional" /></SelectTrigger>
                    <SelectContent className="bg-card border-border">
                      {dealOptions.map((d: any) => <SelectItem key={d.id} value={d.id}>{d.title}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div><Label className="text-secondary-foreground">Fällig am</Label><Input name="due_date" type="datetime-local" className="bg-surface border-border rounded-md" /></div>
              <Button type="submit" disabled={createMutation.isPending} className="w-full bg-primary text-primary-foreground rounded-md">
                {createMutation.isPending ? "Wird erstellt..." : "Erstellen"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="bg-card border border-border w-full sm:w-auto overflow-x-auto">
          <TabsTrigger value="all" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Alle</TabsTrigger>
          <TabsTrigger value="today" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Heute fällig</TabsTrigger>
          <TabsTrigger value="overdue" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Überfällig</TabsTrigger>
          <TabsTrigger value="completed" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Abgeschlossen</TabsTrigger>
        </TabsList>
      </Tabs>

      {filtered.length === 0 ? (
        <EmptyState icon={CalendarCheck} title="Keine Aktivitäten" description="Es gibt keine Aktivitäten in dieser Kategorie." />
      ) : (
        <div className="space-y-2">
          {filtered.map((a: any) => {
            const Icon = typeIcons[a.type] || CalendarCheck;
            const isOverdue = a.due_date && isBefore(new Date(a.due_date), now) && !a.completed_at;
            return (
              <div key={a.id} className="bg-card rounded-lg border border-border p-4 flex items-center gap-3">
                <div className="w-8 h-8 rounded-md bg-surface flex items-center justify-center shrink-0">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground font-medium">{a.title}</p>
                  <div className="flex items-center gap-2 mt-0.5">
                    {a.contacts && <span className="text-xs text-secondary-foreground">{a.contacts.first_name} {a.contacts.last_name}</span>}
                    {a.deals && <span className="text-xs text-secondary-foreground">{a.deals.title}</span>}
                    {a.due_date && (
                      <span className={`text-xs ${isOverdue ? "text-destructive" : "text-muted-foreground"}`}>
                        Fällig: {format(new Date(a.due_date), "dd.MM.yyyy", { locale: de })}
                      </span>
                    )}
                  </div>
                </div>
                {!a.completed_at ? (
                  <Button variant="ghost" size="sm" onClick={() => completeMutation.mutate(a.id)} className="text-muted-foreground hover:text-success">
                    <CheckCircle className="h-4 w-4" />
                  </Button>
                ) : (
                  <StatusBadge status="won" />
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
