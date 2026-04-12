import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { EmptyState } from "@/components/crm/EmptyState";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { ContactAvatar } from "@/components/crm/ContactAvatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { ArrowLeft, Globe } from "lucide-react";

const sizeLabels: Record<string, string> = { startup: "Startup", smb: "KMU", mid_market: "Mittelstand", enterprise: "Konzern" };

function formatCurrency(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

export default function CompanyDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  if (isLoading) return <div className="text-secondary-foreground">Laden...</div>;
  if (!company) return <EmptyState title="Unternehmen nicht gefunden" description="Dieses Unternehmen existiert nicht." />;

  return (
    <div className="space-y-6 animate-fade-in">
      <button onClick={() => navigate("/companies")} className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Zurück
      </button>

      <div>
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

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="bg-card border border-border">
          <TabsTrigger value="overview" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Übersicht</TabsTrigger>
          <TabsTrigger value="contacts" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Kontakte</TabsTrigger>
          <TabsTrigger value="deals" className="data-[state=active]:bg-surface data-[state=active]:text-foreground text-muted-foreground">Deals</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="bg-card rounded-lg border border-border p-5 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div><Label className="text-muted-foreground text-xs">Branche</Label><p className="text-sm text-foreground">{company.industry || "—"}</p></div>
            <div><Label className="text-muted-foreground text-xs">Größe</Label><p className="text-sm text-foreground">{company.size ? sizeLabels[company.size] : "—"}</p></div>
            <div><Label className="text-muted-foreground text-xs">Land</Label><p className="text-sm text-foreground">{company.country || "—"}</p></div>
            <div><Label className="text-muted-foreground text-xs">Stadt</Label><p className="text-sm text-foreground">{company.city || "—"}</p></div>
          </div>
          <div className="mt-4 bg-card rounded-lg border border-border p-5">
            <Label className="text-muted-foreground text-xs">Notizen</Label>
            <Textarea
              defaultValue={company.notes || ""}
              placeholder="Notizen..."
              className="bg-surface border-border rounded-md min-h-[120px] mt-2"
              onBlur={(e) => {
                if (e.target.value !== (company.notes || "")) updateMutation.mutate({ notes: e.target.value });
              }}
            />
          </div>
        </TabsContent>

        <TabsContent value="contacts">
          {contacts.length === 0 ? (
            <EmptyState title="Keine Kontakte" description="Diesem Unternehmen sind noch keine Kontakte zugeordnet." />
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
        </TabsContent>

        <TabsContent value="deals">
          {deals.length === 0 ? (
            <EmptyState title="Keine Deals" description="Diesem Unternehmen sind noch keine Deals zugeordnet." />
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
        </TabsContent>
      </Tabs>
    </div>
  );
}
