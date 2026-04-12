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
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Handshake } from "lucide-react";
import { AutomationManager } from "@/components/crm/AutomationManager";
import { useNavigate } from "react-router-dom";
import { DndContext, DragEndEvent, DragOverlay, PointerSensor, useSensor, useSensors, useDroppable, useDraggable } from "@dnd-kit/core";

const stages = ["lead", "qualified", "proposal", "negotiation", "won", "lost"] as const;
const stageLabels: Record<string, string> = {
  lead: "Lead", qualified: "Qualifiziert", proposal: "Angebot",
  negotiation: "Verhandlung", won: "Gewonnen", lost: "Verloren",
};

function formatCurrency(v: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(v);
}

function DealCard({ deal, onClick, dragging }: { deal: any; onClick: () => void; dragging?: boolean }) {
  const { attributes, listeners, setNodeRef, transform } = useDraggable({ id: deal.id });
  const style = transform ? { transform: `translate(${transform.x}px, ${transform.y}px)`, zIndex: 50 } : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      {...listeners}
      {...attributes}
      onClick={onClick}
      className={`bg-surface rounded-lg border p-2 sm:p-3 cursor-grab active:cursor-grabbing hover:border-primary/30 transition-colors mb-2 select-none ${dragging ? "opacity-50 border-primary/50" : "border-border"}`}
    >
      <p className="text-sm text-foreground font-medium truncate">{deal.title}</p>
      {deal.companies && (
        <p className="text-xs text-secondary-foreground mt-0.5">{deal.companies.name}</p>
      )}
      {deal.contacts && !deal.companies && (
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

function KanbanColumn({ stage, label, deals, onDealClick }: { stage: string; label: string; deals: any[]; onDealClick: (id: string) => void }) {
  const { setNodeRef, isOver } = useDroppable({ id: stage });
  const totalValue = deals.reduce((s, d) => s + Number(d.value), 0);

  return (
    <div
      ref={setNodeRef}
      className={`bg-card rounded-lg border p-3 min-w-[160px] sm:min-w-[200px] flex flex-col transition-colors ${isOver ? "border-primary/60 bg-primary/5" : "border-border"}`}
    >
      <div className="mb-3">
        <div className="flex items-center justify-between">
          <h3 className="text-xs font-medium text-foreground uppercase">{label}</h3>
          <span className="text-xs text-muted-foreground">{deals.length}</span>
        </div>
        <p className="text-xs text-primary font-medium">{formatCurrency(totalValue)}</p>
      </div>
      <div className="flex-1 min-h-[60px]">
        {deals.map((deal) => (
          <DealCard key={deal.id} deal={deal} onClick={() => onDealClick(deal.id)} />
        ))}
      </div>
      <AutomationManager stage={stage} stageLabel={label} />
    </div>
  );
}

export default function DealPipeline() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [activeDealId, setActiveDealId] = useState<string | null>(null);
  const [lostReasonDeal, setLostReasonDeal] = useState<{ id: string; title: string } | null>(null);
  const [lostReason, setLostReason] = useState("");

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

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-select"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").order("name");
      return data || [];
    },
  });

  const updateStageMutation = useMutation({
    mutationFn: async ({ dealId, stage, lostReason }: { dealId: string; stage: string; lostReason?: string }) => {
      const updates: any = { stage: stage as any };
      if (stage === "won") updates.close_date = new Date().toISOString().split("T")[0];
      if (stage === "lost" && lostReason) updates.lost_reason = lostReason;
      const { error } = await supabase.from("deals").update(updates).eq("id", dealId);
      if (error) throw error;

      // Log stage change as activity
      const deal = deals.find((d) => d.id === dealId);
      const fromLabel = deal ? stageLabels[deal.stage] : "?";
      const toLabel = stageLabels[stage];
      await supabase.from("activities").insert({
        type: "note" as const,
        title: `Deal-Phase: ${fromLabel} → ${toLabel}`,
        description: stage === "lost" && lostReason ? `Grund: ${lostReason}` : null,
        deal_id: dealId,
        company_id: deal?.company_id || null,
        contact_id: deal?.contact_id || null,
        owner_id: user!.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["deals"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
    },
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
        company_id: formData.get("company_id") as string || null,
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

  const handleDragStart = (event: any) => setActiveDealId(String(event.active.id));

  const handleDragEnd = (event: DragEndEvent) => {
    setActiveDealId(null);
    const { active, over } = event;
    if (!over) return;
    const overId = String(over.id);
    if (stages.includes(overId as any)) {
      const deal = deals.find((d) => d.id === String(active.id));
      if (deal && deal.stage !== overId) {
        if (overId === "lost") {
          setLostReasonDeal({ id: String(active.id), title: deal.title });
          setLostReason("");
        } else {
          updateStageMutation.mutate({ dealId: String(active.id), stage: overId });
        }
      }
    }
  };

  const handleLostConfirm = () => {
    if (!lostReasonDeal) return;
    updateStageMutation.mutate({ dealId: lostReasonDeal.id, stage: "lost", lostReason: lostReason || undefined });
    setLostReasonDeal(null);
    setLostReason("");
  };

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 8 } }));
  const activeDeal = activeDealId ? deals.find((d) => d.id === activeDealId) : null;

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Deals</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md"><Plus className="h-4 w-4 mr-1" /> Neuer Deal</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-foreground">Neuer Deal</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
              <div><Label className="text-secondary-foreground">Titel</Label><Input name="title" required className="bg-surface border-border rounded-md" /></div>
              <div><Label className="text-secondary-foreground">Unternehmen</Label>
                <Select name="company_id">
                  <SelectTrigger className="bg-surface border-border rounded-md"><SelectValue placeholder="Unternehmen wählen" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
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
        <DndContext sensors={sensors} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <div className="flex gap-3 overflow-x-auto pb-4 snap-x snap-mandatory">
            {stages.map((stage) => (
              <KanbanColumn
                key={stage}
                stage={stage}
                label={stageLabels[stage]}
                deals={deals.filter((d) => d.stage === stage)}
                onDealClick={(id) => navigate(`/deals/${id}`)}
              />
            ))}
          </div>
          <DragOverlay>
            {activeDeal ? (
              <div className="bg-surface rounded-lg border border-primary/60 p-3 w-[200px] shadow-xl opacity-95">
                <p className="text-sm text-foreground font-medium truncate">{activeDeal.title}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-sm text-primary font-medium">{formatCurrency(Number(activeDeal.value))}</span>
                  <span className="text-xs text-muted-foreground">{activeDeal.probability}%</span>
                </div>
              </div>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      {/* Lost Reason Dialog */}
      <Dialog open={!!lostReasonDeal} onOpenChange={(open) => { if (!open) { setLostReasonDeal(null); setLostReason(""); } }}>
        <DialogContent className="bg-card border-border">
          <DialogHeader><DialogTitle className="text-foreground">Deal verloren: {lostReasonDeal?.title}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-secondary-foreground">Grund (optional)</Label>
              <Textarea value={lostReason} onChange={(e) => setLostReason(e.target.value)} placeholder="Warum wurde der Deal verloren?" className="bg-surface border-border rounded-md" />
            </div>
            <div className="flex gap-2">
              <Button onClick={handleLostConfirm} className="flex-1 bg-destructive text-destructive-foreground">Als verloren markieren</Button>
              <Button variant="outline" onClick={() => { setLostReasonDeal(null); setLostReason(""); }} className="border-border">Abbrechen</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
