import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { EmptyState } from "@/components/crm/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Handshake, GripVertical } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { DndContext, closestCenter, DragEndEvent, PointerSensor, useSensor, useSensors } from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

const stages = ["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const;
const stageLabels: Record<string, string> = {
  lead: "Lead", qualified: "Qualifiziert", proposal: "Angebot",
  negotiation: "Verhandlung", won: "Gewonnen", lost: "Verloren",
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

function DealCard({ deal, onClick }: { deal: any; onClick: () => void }) {
  return (
    <div onClick={onClick} className="bg-surface rounded-lg border border-border p-3 cursor-pointer hover:border-primary/30 transition-colors mb-2">
      <p className="text-sm text-foreground font-medium truncate">{deal.title}</p>
      {deal.contacts && (
        <p className="text-xs text-secondary-foreground mt-0.5">{deal.contacts.first_name} {deal.contacts.last_name}</p>
      )}
      <div className="flex items-center justify-between mt-2">
        <span className="text-sm text-primary font-medium">{formatCurrency(Number(deal.value))}</span>
        <span className="text-xs text-muted-foreground">{deal.probability}%</span>
      </div>
      {deal.close_date && (
        <p className="text-xs text-muted-foreground mt-1">{new Date(deal.close_date).toLocaleDateString("de-DE")}</p>
      )}
    </div>
  );
}

export default function DealPipeline() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);

  const { data: deals = [], isLoading } = useQuery({
    queryKey: ["deals"],
    queryFn: async () => {
      const { data, error } = await supabase.from("deals").select("*, contacts(first_name, last_name), companies(name)").order("created_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-select"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name");
      return data || [];
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ dealId, stage }: { dealId: string; stage: string }) => {
      const { error } = await supabase.from("deals").update({ stage: stage as any }).eq("id", dealId);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["deals"] }),
    onError: (e: any) => toast.error(e.message),
  });

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { error } = await supabase.from("deals").insert({
        title: formData.get("title") as string,
        value: Number(formData.get("value")) || 0,
        stage: (formData.get("stage") as any) || "lead",
        probability: Number(formData.get("probability")) || 0,
        close_date: formData.get("close_date") as string || null,
        contact_id: formData.get("contact_id") as string || null,
        owner_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      toast.success("Deal erstellt");
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    // Check if dropped on a stage column
    if (stages.includes(overId as any)) {
      updateStageMutation.mutate({ dealId: String(active.id), stage: overId });
    }
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Deals</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md"><Plus className="h-4 w-4 mr-1" /> Neuer Deal</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle className="text-foreground">Neuer Deal</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
              <div><Label className="text-secondary-foreground">Titel</Label><Input name="title" required className="bg-surface border-border rounded-md" /></div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-secondary-foreground">Wert (€)</Label><Input name="value" type="number" step="0.01" className="bg-surface border-border rounded-md" /></div>
                <div><Label className="text-secondary-foreground">Wahrscheinlichkeit (%)</Label><Input name="probability" type="number" min="0" max="100" className="bg-surface border-border rounded-md" /></div>
              </div>
              <div><Label className="text-secondary-foreground">Phase</Label>
                <Select name="stage" defaultValue="lead">
                  <SelectTrigger className="bg-surface border-border rounded-md"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {stages.map((s) => <SelectItem key={s} value={s}>{stageLabels[s]}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-secondary-foreground">Kontakt</Label>
                <Select name="contact_id">
                  <SelectTrigger className="bg-surface border-border rounded-md"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {contacts.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-secondary-foreground">Abschlussdatum</Label><Input name="close_date" type="date" className="bg-surface border-border rounded-md" /></div>
              <Button type="submit" disabled={createMutation.isPending} className="w-full bg-primary text-primary-foreground rounded-md">
                {createMutation.isPending ? "Wird erstellt..." : "Deal erstellen"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {deals.length === 0 && !isLoading ? (
        <EmptyState icon={Handshake} title="Keine Deals" description="Erstelle deinen ersten Deal, um die Pipeline zu füllen." />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 overflow-x-auto">
            {stages.map((stage) => {
              const stageDeals = deals.filter((d) => d.stage === stage);
              const totalValue = stageDeals.reduce((s, d) => s + Number(d.value), 0);
              return (
                <div key={stage} id={stage} className="bg-card rounded-lg border border-border p-3 min-w-[200px]">
                  <div className="mb-3">
                    <div className="flex items-center justify-between">
                      <h3 className="text-xs font-medium text-foreground uppercase">{stageLabels[stage]}</h3>
                      <span className="text-xs text-muted-foreground">{stageDeals.length}</span>
                    </div>
                    <p className="text-xs text-primary font-medium">{formatCurrency(totalValue)}</p>
                  </div>
                  <div className="space-y-0 min-h-[60px]"
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {}}
                  >
                    {stageDeals.map((deal) => (
                      <DealCard key={deal.id} deal={deal} onClick={() => navigate(`/deals/${deal.id}`)} />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </DndContext>
      )}
    </div>
  );
}
