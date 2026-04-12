import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/crm/EmptyState";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { ArrowLeft, Phone, Mail, Calendar, FileText } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";

const stageLabels: Record<string, string> = {
  lead: "Lead", qualified: "Qualifiziert", proposal: "Angebot",
  negotiation: "Verhandlung", won: "Gewonnen", lost: "Verloren",
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

export default function DealDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: deal, isLoading } = useQuery({
    queryKey: ["deal", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("*, contacts(id, first_name, last_name), companies(id, name)").eq("id", id!).single();
      if (error) throw error;
      return data;
    },
  });

  const { data: activities = [] } = useQuery({
    queryKey: ["deal-activities", id],
    queryFn: async () => {
      const { data } = await supabase.from("activities").select("*").eq("deal_id", id!).order("created_at", { ascending: false });
      return data || [];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async (updates: any) => {
      const { error } = await supabase.from("deals").update(updates).eq("id", id!);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deal", id] });
      toast.success("Deal aktualisiert");
    },
    onError: (e: any) => toast.error(e.message),
  });

  if (isLoading) return <div className="text-secondary-foreground">Laden...</div>;
  if (!deal) return <EmptyState title="Deal nicht gefunden" description="Dieser Deal existiert nicht." />;

  const activityIcons: Record<string, any> = { call: Phone, email: Mail, meeting: Calendar, task: Calendar, note: FileText };

  return (
    <div className="space-y-6 animate-fade-in">
      <button onClick={() => navigate("/deals")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Zurück
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">{deal.title}</h1>
          <p className="text-2xl text-primary font-bold mt-1">{formatCurrency(Number(deal.value))}</p>
        </div>
        <div className="text-right">
          <StatusBadge status={deal.stage} />
          <p className="text-xs text-muted-foreground mt-1">{deal.probability}% Wahrscheinlichkeit</p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="overview" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Übersicht</TabsTrigger>
          <TabsTrigger value="activities" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Aktivitäten</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="bg-card rounded-lg border border-border p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label className="text-muted-foreground text-xs">Phase</Label>
              <Select value={deal.stage} onValueChange={(v) => updateMutation.mutate({ stage: v })}>
                <SelectTrigger className="w-fit bg-transparent border-none p-0 h-auto mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.entries(stageLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Kontakt</Label>
              <p className="text-sm text-foreground cursor-pointer hover:text-primary" onClick={() => deal.contacts && navigate(`/contacts/${deal.contacts.id}`)}>
                {deal.contacts ? `${deal.contacts.first_name} ${deal.contacts.last_name}` : "—"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Unternehmen</Label>
              <p className="text-sm text-foreground cursor-pointer hover:text-primary" onClick={() => deal.companies && navigate(`/companies/${deal.companies.id}`)}>
                {deal.companies?.name || "—"}
              </p>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Abschlussdatum</Label>
              <p className="text-sm text-foreground">{deal.close_date ? format(new Date(deal.close_date), "dd.MM.yyyy", { locale: de }) : "—"}</p>
            </div>
          </div>
          <div className="mt-4 bg-card rounded-lg border border-border p-5">
            <Label className="text-muted-foreground text-xs">Notizen</Label>
            <Textarea
              defaultValue={deal.notes || ""}
              placeholder="Notizen..."
              className="bg-surface border-border rounded-md min-h-[120px] mt-2"
              onBlur={(e) => {
                if (e.target.value !== (deal.notes || "")) updateMutation.mutate({ notes: e.target.value });
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="activities">
          {activities.length === 0 ? (
            <EmptyState title="Keine Aktivitäten" description="Noch keine Aktivitäten für diesen Deal." />
          ) : (
            <div className="space-y-3">
              {activities.map((a: any) => {
                const Icon = activityIcons[a.type] || Calendar;
                return (
                  <div key={a.id} className="bg-card rounded-lg border border-border p-4 flex items-start gap-3">
                    <div className="w-8 h-8 rounded-md bg-surface flex items-center justify-center shrink-0">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm text-foreground font-medium">{a.title}</p>
                      <p className="text-xs text-muted-foreground">{format(new Date(a.created_at), "dd.MM.yyyy HH:mm", { locale: de })}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
