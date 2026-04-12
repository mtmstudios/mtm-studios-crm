import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { ContactAvatar } from "@/components/crm/ContactAvatar";
import { EmptyState } from "@/components/crm/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { ArrowLeft, Plus, Phone, Mail, Calendar, FileText, Trash2 } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

export default function ContactDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [activityDialogOpen, setActivityDialogOpen] = useState(false);

  const { data: contact, isLoading } = useQuery({
    queryKey: ["contact", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("contacts").select("*, companies(id, name)").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["contact-activities", id],
    queryFn: async () => {
      const { data } = await supabase.from("activities").select("*").eq("contact_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["contact-deals", id],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("*").eq("contact_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from("contacts").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact", id] });
      toast.success("Kontakt aktualisiert");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("contacts").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kontakt gelöscht");
      navigate("/contacts");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const addActivityMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { error } = await supabase.from("activities").insert({
        type: formData.get("type") as any,
        title: formData.get("title") as string,
        description: formData.get("description") as string || null,
        due_date: formData.get("due_date") ? new Date(formData.get("due_date") as string).toISOString() : null,
        contact_id: id!,
        owner_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contact-activities", id] });
      toast.success("Aktivität hinzugefügt");
      setActivityDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-secondary-foreground">Laden...</div>;
  if (!contact) return <EmptyState title="Kontakt nicht gefunden" description="Dieser Kontakt existiert nicht." />;

  const activityIcons: Record<string, any> = { call: Phone, email: Mail, meeting: Calendar, task: Calendar, note: FileText };

  function formatCurrency(v: number) {
    return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/contacts")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> Zurück
        </button>
        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="ghost" size="sm" className="text-muted-foreground hover:text-destructive">
              <Trash2 className="h-4 w-4" />
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent className="bg-card border-border">
            <AlertDialogHeader>
              <AlertDialogTitle className="text-foreground">Kontakt löschen?</AlertDialogTitle>
              <AlertDialogDescription>"{contact.first_name} {contact.last_name}" wird unwiderruflich gelöscht.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border">Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground">Löschen</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex items-center gap-4">
        <ContactAvatar firstName={contact.first_name} lastName={contact.last_name} className="w-12 h-12 text-lg" />
        <div>
          <h1 className="text-xl font-semibold text-foreground">{contact.first_name} {contact.last_name}</h1>
          <p className="text-sm text-secondary-foreground">{contact.position || ""} {contact.companies?.name ? `bei ${contact.companies.name}` : ""}</p>
        </div>
        <StatusBadge status={contact.status} className="ml-auto" />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="overview" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Übersicht</TabsTrigger>
          <TabsTrigger value="activities" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Aktivitäten ({activities.length})</TabsTrigger>
          <TabsTrigger value="deals" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Deals ({deals.length})</TabsTrigger>
          <TabsTrigger value="notes" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Notizen</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="bg-card rounded-lg border border-border p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Vorname</Label>
              <Input defaultValue={contact.first_name} className="bg-surface border-border rounded-md mt-1" onBlur={(e) => { if (e.target.value !== contact.first_name) updateMutation.mutate({ first_name: e.target.value }); }} />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Nachname</Label>
              <Input defaultValue={contact.last_name} className="bg-surface border-border rounded-md mt-1" onBlur={(e) => { if (e.target.value !== contact.last_name) updateMutation.mutate({ last_name: e.target.value }); }} />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">E-Mail</Label>
              <Input type="email" defaultValue={contact.email || ""} className="bg-surface border-border rounded-md mt-1" onBlur={(e) => { if (e.target.value !== (contact.email || "")) updateMutation.mutate({ email: e.target.value || null }); }} />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Telefon</Label>
              <Input defaultValue={contact.phone || ""} className="bg-surface border-border rounded-md mt-1" onBlur={(e) => { if (e.target.value !== (contact.phone || "")) updateMutation.mutate({ phone: e.target.value || null }); }} />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Position</Label>
              <Input defaultValue={contact.position || ""} className="bg-surface border-border rounded-md mt-1" onBlur={(e) => { if (e.target.value !== (contact.position || "")) updateMutation.mutate({ position: e.target.value || null }); }} />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Unternehmen</Label>
              <p className="text-sm text-foreground cursor-pointer hover:text-primary mt-2" onClick={() => contact.companies && navigate(`/companies/${contact.companies.id}`)}>
                {contact.companies?.name || "—"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Status</Label>
              <Select value={contact.status} onValueChange={(v) => updateMutation.mutate({ status: v })}>
                <SelectTrigger className="bg-surface border-border rounded-md mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="lead">Lead</SelectItem>
                  <SelectItem value="prospect">Interessent</SelectItem>
                  <SelectItem value="customer">Kunde</SelectItem>
                  <SelectItem value="inactive">Inaktiv</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Quelle</Label>
              <StatusBadge status={contact.source} className="mt-2" />
            </div>
          </div>
        </TabsContent>

        <TabsContent value="activities">
          <div className="space-y-4">
            <Dialog open={activityDialogOpen} onOpenChange={setActivityDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground rounded-md"><Plus className="h-4 w-4 mr-1" /> Aktivität hinzufügen</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle className="text-foreground">Aktivität hinzufügen</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); addActivityMutation.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
                  <div><Label className="text-secondary-foreground">Typ</Label>
                    <Select name="type" defaultValue="call">
                      <SelectTrigger className="bg-surface border-border rounded-md"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="call">Anruf</SelectItem>
                        <SelectItem value="email">E-Mail</SelectItem>
                        <SelectItem value="meeting">Meeting</SelectItem>
                        <SelectItem value="task">Aufgabe</SelectItem>
                        <SelectItem value="note">Notiz</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div><Label className="text-secondary-foreground">Titel</Label><Input name="title" required className="bg-surface border-border rounded-md" /></div>
                  <div><Label className="text-secondary-foreground">Beschreibung</Label><Textarea name="description" className="bg-surface border-border rounded-md" /></div>
                  <div><Label className="text-secondary-foreground">Fällig am</Label><Input name="due_date" type="datetime-local" className="bg-surface border-border rounded-md" /></div>
                  <Button type="submit" disabled={addActivityMutation.isPending} className="w-full bg-primary text-primary-foreground rounded-md">
                    {addActivityMutation.isPending ? "Wird erstellt..." : "Hinzufügen"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {activities.length === 0 ? (
              <EmptyState title="Keine Aktivitäten" description="Füge eine Aktivität für diesen Kontakt hinzu." />
            ) : (
              <div className="space-y-3">
                {activities.map((a: any) => {
                  const Icon = activityIcons[a.type] || Calendar;
                  return (
                    <div key={a.id} className="bg-card rounded-lg border border-border p-4 flex items-start gap-3">
                      <div className="w-8 h-8 rounded-md bg-surface flex items-center justify-center shrink-0">
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground font-medium">{a.title}</p>
                        {a.description && <p className="text-xs text-secondary-foreground mt-0.5">{a.description}</p>}
                        <p className="text-xs text-muted-foreground mt-1">
                          {format(new Date(a.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                          {a.due_date && ` · Fällig: ${format(new Date(a.due_date), "dd.MM.yyyy", { locale: de })}`}
                        </p>
                      </div>
                      {a.completed_at && <StatusBadge status="won" />}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="deals">
          {deals.length === 0 ? (
            <EmptyState title="Keine Deals" description="Diesem Kontakt sind noch keine Deals zugeordnet." />
          ) : (
            <div className="space-y-3">
              {deals.map((d: any) => (
                <div key={d.id} onClick={() => navigate(`/deals/${d.id}`)} className="bg-card rounded-lg border border-border p-4 cursor-pointer hover:bg-surface transition-colors">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground font-medium">{d.title}</span>
                    <StatusBadge status={d.stage} />
                  </div>
                  <p className="text-sm text-primary font-medium mt-1">{formatCurrency(Number(d.value))}</p>
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        <TabsContent value="notes">
          <div className="bg-card rounded-lg border border-border p-5">
            <Textarea
              defaultValue={contact.notes || ""}
              placeholder="Notizen zum Kontakt..."
              className="bg-surface border-border rounded-md min-h-[200px]"
              onBlur={(e) => { if (e.target.value !== (contact.notes || "")) updateMutation.mutate({ notes: e.target.value }); }}
            />
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
