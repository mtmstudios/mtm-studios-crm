import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { EmptyState } from "@/components/crm/EmptyState";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { ContactAvatar } from "@/components/crm/ContactAvatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, Globe, Plus, Trash2 } from "lucide-react";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const sizeLabels: Record<string, string> = { startup: "Startup", smb: "KMU", mid_market: "Mittelstand", enterprise: "Konzern" };

function formatCurrency(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [contactDialogOpen, setContactDialogOpen] = useState(false);
  const [dealDialogOpen, setDealDialogOpen] = useState(false);

  const { data: company, isLoading } = useQuery({
    queryKey: ["company", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("companies").select("*").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["company-contacts", id],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("*").eq("company_id", id!);
      return data || [];
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["company-deals", id],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("*, contacts(first_name, last_name)").eq("company_id", id!);
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from("companies").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company", id] });
      toast.success("Unternehmen aktualisiert");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("companies").delete().eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Unternehmen gelöscht");
      navigate("/companies");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createContactMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { error } = await supabase.from("contacts").insert({
        first_name: formData.get("first_name") as string,
        last_name: formData.get("last_name") as string,
        email: formData.get("email") as string || null,
        phone: formData.get("phone") as string || null,
        position: formData.get("position") as string || null,
        company_id: id!,
        owner_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-contacts", id] });
      toast.success("Kontakt erstellt");
      setContactDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const createDealMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { error } = await supabase.from("deals").insert({
        title: formData.get("title") as string,
        value: Number(formData.get("value")) || 0,
        stage: (formData.get("stage") as any) || "lead",
        probability: Number(formData.get("probability")) || 0,
        company_id: id!,
        owner_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["company-deals", id] });
      toast.success("Deal erstellt");
      setDealDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-secondary-foreground">Laden...</div>;
  if (!company) return <EmptyState title="Unternehmen nicht gefunden" description="Dieses Unternehmen existiert nicht." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <button onClick={() => navigate("/companies")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
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
              <AlertDialogTitle className="text-foreground">Unternehmen löschen?</AlertDialogTitle>
              <AlertDialogDescription>"{company.name}" wird unwiderruflich gelöscht. Verknüpfte Kontakte und Deals bleiben erhalten.</AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel className="border-border">Abbrechen</AlertDialogCancel>
              <AlertDialogAction onClick={() => deleteMutation.mutate()} className="bg-destructive text-destructive-foreground">Löschen</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>

      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h1 className="text-xl font-semibold text-foreground">{company.name}</h1>
          <div className="flex items-center gap-3 mt-1">
            {company.website && (
              <a href={company.website.startsWith("http") ? company.website : `https://${company.website}`} target="_blank" rel="noopener noreferrer" className="text-sm text-primary flex items-center gap-1 hover:underline">
                <Globe className="h-3 w-3" /> {company.website}
              </a>
            )}
            {company.industry && <span className="text-sm text-secondary-foreground">{company.industry}</span>}
          </div>
        </div>
        <StatusBadge status={company.status} />
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="overview" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Übersicht</TabsTrigger>
          <TabsTrigger value="contacts" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Kontakte ({contacts.length})</TabsTrigger>
          <TabsTrigger value="deals" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Deals ({deals.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="bg-card rounded-lg border border-border p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Name</Label>
              <Input defaultValue={company.name} className="bg-surface border-border rounded-md mt-1" onBlur={(e) => { if (e.target.value !== company.name) updateMutation.mutate({ name: e.target.value }); }} />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Status</Label>
              <Select value={company.status} onValueChange={(v) => updateMutation.mutate({ status: v })}>
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
              <Label className="text-muted-foreground text-xs">Branche</Label>
              <Input defaultValue={company.industry || ""} placeholder="z.B. Gesundheit & Medizin" className="bg-surface border-border rounded-md mt-1" onBlur={(e) => { if (e.target.value !== (company.industry || "")) updateMutation.mutate({ industry: e.target.value || null }); }} />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Website</Label>
              <Input defaultValue={company.website || ""} placeholder="https://..." className="bg-surface border-border rounded-md mt-1" onBlur={(e) => { if (e.target.value !== (company.website || "")) updateMutation.mutate({ website: e.target.value || null }); }} />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Stadt</Label>
              <Input defaultValue={company.city || ""} className="bg-surface border-border rounded-md mt-1" onBlur={(e) => { if (e.target.value !== (company.city || "")) updateMutation.mutate({ city: e.target.value || null }); }} />
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Land</Label>
              <Input defaultValue={company.country || ""} className="bg-surface border-border rounded-md mt-1" onBlur={(e) => { if (e.target.value !== (company.country || "")) updateMutation.mutate({ country: e.target.value || null }); }} />
            </div>
          </div>
          <div className="mt-4 bg-card rounded-lg border border-border p-5">
            <Label className="text-muted-foreground text-xs">Notizen</Label>
            <Textarea
              defaultValue={company.notes || ""}
              placeholder="Notizen..."
              className="bg-surface border-border rounded-md min-h-[120px] mt-2"
              onBlur={(e) => { if (e.target.value !== (company.notes || "")) updateMutation.mutate({ notes: e.target.value }); }}
            />
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          <div className="space-y-4">
            <Dialog open={contactDialogOpen} onOpenChange={setContactDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground rounded-md"><Plus className="h-4 w-4 mr-1" /> Neuer Kontakt</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle className="text-foreground">Kontakt für {company.name}</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createContactMutation.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-secondary-foreground">Vorname</Label><Input name="first_name" required className="bg-surface border-border rounded-md" /></div>
                    <div><Label className="text-secondary-foreground">Nachname</Label><Input name="last_name" required className="bg-surface border-border rounded-md" /></div>
                  </div>
                  <div><Label className="text-secondary-foreground">E-Mail</Label><Input name="email" type="email" className="bg-surface border-border rounded-md" /></div>
                  <div><Label className="text-secondary-foreground">Telefon</Label><Input name="phone" className="bg-surface border-border rounded-md" /></div>
                  <div><Label className="text-secondary-foreground">Position</Label><Input name="position" className="bg-surface border-border rounded-md" /></div>
                  <Button type="submit" disabled={createContactMutation.isPending} className="w-full bg-primary text-primary-foreground rounded-md">
                    {createContactMutation.isPending ? "Wird erstellt..." : "Kontakt erstellen"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {contacts.length === 0 ? (
              <EmptyState title="Keine Kontakte" description="Erstelle den ersten Kontakt für dieses Unternehmen." />
            ) : (
              <div className="space-y-2">
                {contacts.map((c: any) => (
                  <div key={c.id} onClick={() => navigate(`/contacts/${c.id}`)} className="bg-card rounded-lg border border-border p-4 flex items-center gap-3 cursor-pointer hover:bg-surface transition-colors">
                    <ContactAvatar firstName={c.first_name} lastName={c.last_name} />
                    <div>
                      <p className="text-sm text-foreground font-medium">{c.first_name} {c.last_name}</p>
                      <p className="text-xs text-secondary-foreground">{c.position || c.email || ""}</p>
                    </div>
                    <StatusBadge status={c.status} className="ml-auto" />
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        <TabsContent value="deals">
          <div className="space-y-4">
            <Dialog open={dealDialogOpen} onOpenChange={setDealDialogOpen}>
              <DialogTrigger asChild>
                <Button className="bg-primary text-primary-foreground rounded-md"><Plus className="h-4 w-4 mr-1" /> Neuer Deal</Button>
              </DialogTrigger>
              <DialogContent className="bg-card border-border">
                <DialogHeader><DialogTitle className="text-foreground">Deal für {company.name}</DialogTitle></DialogHeader>
                <form onSubmit={(e) => { e.preventDefault(); createDealMutation.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
                  <div><Label className="text-secondary-foreground">Titel</Label><Input name="title" required className="bg-surface border-border rounded-md" /></div>
                  <div className="grid grid-cols-2 gap-3">
                    <div><Label className="text-secondary-foreground">Wert (€)</Label><Input name="value" type="number" step="0.01" className="bg-surface border-border rounded-md" /></div>
                    <div><Label className="text-secondary-foreground">Wahrscheinlichkeit (%)</Label><Input name="probability" type="number" min="0" max="100" className="bg-surface border-border rounded-md" /></div>
                  </div>
                  <div><Label className="text-secondary-foreground">Phase</Label>
                    <Select name="stage" defaultValue="lead">
                      <SelectTrigger className="bg-surface border-border rounded-md"><SelectValue /></SelectTrigger>
                      <SelectContent className="bg-card border-border">
                        <SelectItem value="lead">Lead</SelectItem>
                        <SelectItem value="qualified">Qualifiziert</SelectItem>
                        <SelectItem value="proposal">Angebot</SelectItem>
                        <SelectItem value="negotiation">Verhandlung</SelectItem>
                        <SelectItem value="won">Gewonnen</SelectItem>
                        <SelectItem value="lost">Verloren</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="submit" disabled={createDealMutation.isPending} className="w-full bg-primary text-primary-foreground rounded-md">
                    {createDealMutation.isPending ? "Wird erstellt..." : "Deal erstellen"}
                  </Button>
                </form>
              </DialogContent>
            </Dialog>

            {deals.length === 0 ? (
              <EmptyState title="Keine Deals" description="Erstelle den ersten Deal für dieses Unternehmen." />
            ) : (
              <div className="space-y-2">
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
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
