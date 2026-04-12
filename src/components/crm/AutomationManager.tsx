import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "sonner";
import { Zap, Plus, Trash2, Mail, MessageSquare, ClipboardList, Globe } from "lucide-react";

const actionLabels: Record<string, { label: string; icon: any }> = {
  send_email: { label: "E-Mail senden", icon: Mail },
  send_sms: { label: "SMS senden", icon: MessageSquare },
  create_task: { label: "Aufgabe erstellen", icon: ClipboardList },
  webhook: { label: "Webhook auslösen", icon: Globe },
};

const stageLabels: Record<string, string> = {
  lead: "Lead", qualified: "Qualifiziert", proposal: "Angebot",
  negotiation: "Verhandlung", won: "Gewonnen", lost: "Verloren",
};

interface AutomationManagerProps {
  stage: string;
  stageLabel: string;
}

export function AutomationManager({ stage, stageLabel }: AutomationManagerProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [actionType, setActionType] = useState<string>("send_email");
  const [actionConfig, setActionConfig] = useState<Record<string, string>>({});

  const { data: automations = [] } = useQuery({
    queryKey: ["automations", stage],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pipeline_automations")
        .select("*")
        .eq("deal_stage", stage as "lead" | "qualified" | "proposal" | "negotiation" | "won" | "lost")
        .order("created_at");
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async () => {
      if (editingId) {
        const { error } = await supabase.from("pipeline_automations").update({
          name,
          action_type: actionType as any,
          action_config: actionConfig,
        }).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pipeline_automations").insert({
          owner_id: user!.id,
          deal_stage: stage as any,
          name,
          action_type: actionType as any,
          action_config: actionConfig,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations", stage] });
      toast.success(editingId ? "Automation aktualisiert" : "Automation erstellt");
      resetForm();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, enabled }: { id: string; enabled: boolean }) => {
      const { error } = await supabase.from("pipeline_automations").update({ enabled }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["automations", stage] }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("pipeline_automations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["automations", stage] });
      toast.success("Automation gelöscht");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const resetForm = () => {
    setDialogOpen(false);
    setEditingId(null);
    setName("");
    setActionType("send_email");
    setActionConfig({});
  };

  const openEdit = (auto: any) => {
    setEditingId(auto.id);
    setName(auto.name);
    setActionType(auto.action_type);
    setActionConfig(auto.action_config || {});
    setDialogOpen(true);
  };

  const openNew = () => {
    resetForm();
    setDialogOpen(true);
  };

  return (
    <>
      <button
        onClick={openNew}
        className="w-full mt-2 flex items-center justify-center gap-1 text-xs text-muted-foreground hover:text-primary py-1.5 rounded border border-dashed border-border hover:border-primary/40 transition-colors"
      >
        <Zap className="h-3 w-3" />
        Automation {automations.length > 0 && `(${automations.length})`}
      </button>

      <Dialog open={dialogOpen} onOpenChange={(open) => { if (!open) resetForm(); else setDialogOpen(true); }}>
        <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto max-w-md">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Zap className="h-4 w-4 text-primary" />
              Automationen – {stageLabel}
            </DialogTitle>
          </DialogHeader>

          {!editingId && automations.length > 0 && (
            <div className="space-y-2 mb-4">
              <p className="text-xs text-muted-foreground font-medium uppercase">Aktive Automationen</p>
              {automations.map((auto: any) => {
                const ActionIcon = actionLabels[auto.action_type]?.icon || Zap;
                return (
                  <div key={auto.id} className="bg-surface rounded-lg border border-border p-3 flex items-center gap-3">
                    <ActionIcon className="h-4 w-4 text-muted-foreground shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-foreground truncate">{auto.name || actionLabels[auto.action_type]?.label}</p>
                      <p className="text-xs text-muted-foreground">{actionLabels[auto.action_type]?.label}</p>
                    </div>
                    <Switch
                      checked={auto.enabled}
                      onCheckedChange={(enabled) => toggleMutation.mutate({ id: auto.id, enabled })}
                      className="shrink-0"
                    />
                    <button onClick={() => openEdit(auto)} className="text-xs text-primary hover:underline shrink-0">Bearbeiten</button>
                    <button onClick={() => deleteMutation.mutate(auto.id)} className="text-muted-foreground hover:text-destructive shrink-0">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          <div className="space-y-3">
            <p className="text-xs text-muted-foreground font-medium uppercase">
              {editingId ? "Automation bearbeiten" : "Neue Automation"}
            </p>

            <div className="bg-surface rounded-lg border border-border p-3">
              <p className="text-xs text-muted-foreground mb-1">Trigger</p>
              <p className="text-sm text-foreground">Wenn ein Deal in <span className="text-primary font-medium">{stageLabel}</span> verschoben wird</p>
            </div>

            <div>
              <Label className="text-secondary-foreground text-xs">Name</Label>
              <Input
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="z.B. Willkommens-E-Mail senden"
                className="bg-surface border-border rounded-md mt-1"
              />
            </div>

            <div>
              <Label className="text-secondary-foreground text-xs">Aktion</Label>
              <Select value={actionType} onValueChange={(v) => { setActionType(v); setActionConfig({}); }}>
                <SelectTrigger className="bg-surface border-border rounded-md mt-1"><SelectValue /></SelectTrigger>
                <SelectContent className="bg-card border-border">
                  {Object.entries(actionLabels).map(([key, { label, icon: Icon }]) => (
                    <SelectItem key={key} value={key}>
                      <span className="flex items-center gap-2"><Icon className="h-3.5 w-3.5" /> {label}</span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {actionType === "send_email" && (
              <div className="space-y-2">
                <div>
                  <Label className="text-secondary-foreground text-xs">Betreff</Label>
                  <Input value={actionConfig.subject || ""} onChange={(e) => setActionConfig({ ...actionConfig, subject: e.target.value })} placeholder="Betreff der E-Mail" className="bg-surface border-border rounded-md mt-1" />
                </div>
                <div>
                  <Label className="text-secondary-foreground text-xs">Nachricht</Label>
                  <Textarea value={actionConfig.body || ""} onChange={(e) => setActionConfig({ ...actionConfig, body: e.target.value })} placeholder="Hallo {{vorname}}, ..." className="bg-surface border-border rounded-md mt-1 min-h-[80px]" />
                </div>
              </div>
            )}

            {actionType === "send_sms" && (
              <div>
                <Label className="text-secondary-foreground text-xs">SMS-Text</Label>
                <Textarea value={actionConfig.message || ""} onChange={(e) => setActionConfig({ ...actionConfig, message: e.target.value })} placeholder="Hallo {{vorname}}, ..." className="bg-surface border-border rounded-md mt-1 min-h-[80px]" />
              </div>
            )}

            {actionType === "create_task" && (
              <div className="space-y-2">
                <div>
                  <Label className="text-secondary-foreground text-xs">Aufgaben-Titel</Label>
                  <Input value={actionConfig.task_title || ""} onChange={(e) => setActionConfig({ ...actionConfig, task_title: e.target.value })} placeholder="z.B. Follow-up anrufen" className="bg-surface border-border rounded-md mt-1" />
                </div>
                <div>
                  <Label className="text-secondary-foreground text-xs">Beschreibung (optional)</Label>
                  <Textarea value={actionConfig.task_description || ""} onChange={(e) => setActionConfig({ ...actionConfig, task_description: e.target.value })} placeholder="Details zur Aufgabe..." className="bg-surface border-border rounded-md mt-1" />
                </div>
              </div>
            )}

            {actionType === "webhook" && (
              <div className="space-y-2">
                <div>
                  <Label className="text-secondary-foreground text-xs">Webhook-URL</Label>
                  <Input value={actionConfig.url || ""} onChange={(e) => setActionConfig({ ...actionConfig, url: e.target.value })} placeholder="https://..." className="bg-surface border-border rounded-md mt-1" />
                </div>
                <p className="text-xs text-muted-foreground">Deal-Daten werden als JSON-Body gesendet.</p>
              </div>
            )}

            <div className="flex gap-2 pt-2">
              <Button
                onClick={() => createMutation.mutate()}
                disabled={createMutation.isPending || !name.trim()}
                className="flex-1 bg-primary text-primary-foreground rounded-md"
              >
                {createMutation.isPending ? "Wird gespeichert..." : editingId ? "Speichern" : "Automation erstellen"}
              </Button>
              {editingId && (
                <Button variant="outline" onClick={() => { setEditingId(null); setName(""); setActionType("send_email"); setActionConfig({}); }} className="border-border">
                  Abbrechen
                </Button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
