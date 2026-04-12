import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Camera, Download, Upload, Trash2, Plus } from "lucide-react";
import { toast } from "sonner";

export default function Snapshots() {
  const queryClient = useQueryClient();
  const [createOpen, setCreateOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  const { data: snapshots = [] } = useQuery({
    queryKey: ["snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase.from("snapshots").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const createSnapshotMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");

      // Gather CRM configuration data
      const [automations, bookingSettings] = await Promise.all([
        supabase.from("pipeline_automations").select("*").eq("owner_id", user.id),
        supabase.from("booking_settings").select("*").eq("owner_id", user.id),
      ]);

      const snapshotData = {
        pipeline_automations: automations.data || [],
        booking_settings: bookingSettings.data || [],
        exported_at: new Date().toISOString(),
        version: "1.0",
      };

      const { error } = await supabase.from("snapshots").insert({
        owner_id: user.id,
        name,
        description,
        snapshot_data: snapshotData,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snapshots"] });
      setCreateOpen(false);
      setName("");
      setDescription("");
      toast.success("Snapshot erstellt");
    },
    onError: (e) => toast.error(e.message),
  });

  const restoreSnapshotMutation = useMutation({
    mutationFn: async (snapshotData: any) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");

      // Restore pipeline automations
      if (snapshotData.pipeline_automations?.length > 0) {
        // Delete existing automations
        await supabase.from("pipeline_automations").delete().eq("owner_id", user.id);
        // Insert snapshot automations with current user's owner_id
        const automations = snapshotData.pipeline_automations.map((a: any) => ({
          ...a,
          id: undefined, // let DB generate new IDs
          owner_id: user.id,
        }));
        for (const auto of automations) {
          delete auto.id;
          await supabase.from("pipeline_automations").insert(auto);
        }
      }

      // Restore booking settings
      if (snapshotData.booking_settings?.length > 0) {
        await supabase.from("booking_settings").delete().eq("owner_id", user.id);
        const settings = snapshotData.booking_settings.map((s: any) => ({
          ...s,
          id: undefined,
          owner_id: user.id,
        }));
        for (const setting of settings) {
          delete setting.id;
          await supabase.from("booking_settings").insert(setting);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries();
      toast.success("Snapshot wiederhergestellt");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteSnapshotMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("snapshots").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["snapshots"] });
      toast.success("Snapshot gelöscht");
    },
  });

  const exportSnapshot = (snapshot: any) => {
    const blob = new Blob([JSON.stringify(snapshot.snapshot_data, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${snapshot.name.replace(/\s+/g, "_")}_v${snapshot.version}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success("Snapshot exportiert");
  };

  const importSnapshot = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) throw new Error("Nicht angemeldet");

        await supabase.from("snapshots").insert({
          owner_id: user.id,
          name: file.name.replace(".json", ""),
          description: "Importiert",
          snapshot_data: data,
        });
        queryClient.invalidateQueries({ queryKey: ["snapshots"] });
        toast.success("Snapshot importiert");
      } catch {
        toast.error("Ungültige JSON-Datei");
      }
    };
    input.click();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Snapshots</h1>
          <p className="text-sm text-muted-foreground">CRM-Konfiguration exportieren & wiederherstellen</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={importSnapshot}>
            <Upload className="h-4 w-4 mr-2" />Importieren
          </Button>
          <Dialog open={createOpen} onOpenChange={setCreateOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" />Snapshot erstellen</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Neuer Snapshot</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Name *" value={name} onChange={e => setName(e.target.value)} />
                <Textarea placeholder="Beschreibung (optional)" value={description} onChange={e => setDescription(e.target.value)} />
                <p className="text-xs text-muted-foreground">Erfasst: Pipeline-Automationen, Buchungseinstellungen</p>
                <Button className="w-full" onClick={() => createSnapshotMutation.mutate()} disabled={!name}>
                  <Camera className="h-4 w-4 mr-2" />Snapshot erstellen
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {snapshots.length === 0 ? (
        <Card className="bg-card border-border">
          <CardContent className="p-8 text-center text-muted-foreground">
            <Camera className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>Noch keine Snapshots erstellt.</p>
            <p className="text-xs mt-1">Erstelle einen Snapshot, um deine CRM-Konfiguration zu sichern.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {snapshots.map(snapshot => {
            const data = snapshot.snapshot_data as any;
            const autoCount = data?.pipeline_automations?.length || 0;
            const bookingCount = data?.booking_settings?.length || 0;

            return (
              <Card key={snapshot.id} className="bg-card border-border">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-foreground">{snapshot.name}</span>
                        <Badge variant="outline" className="text-xs">v{snapshot.version}</Badge>
                      </div>
                      {snapshot.description && <p className="text-sm text-muted-foreground">{snapshot.description}</p>}
                      <div className="flex gap-3 text-xs text-muted-foreground">
                        <span>{autoCount} Automationen</span>
                        <span>{bookingCount} Buchungseinstellungen</span>
                        <span>{new Date(snapshot.created_at).toLocaleDateString("de-DE", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => exportSnapshot(snapshot)} title="Exportieren">
                        <Download className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => {
                        if (confirm("Snapshot wiederherstellen? Bestehende Konfiguration wird überschrieben.")) {
                          restoreSnapshotMutation.mutate(snapshot.snapshot_data);
                        }
                      }} title="Wiederherstellen">
                        <Upload className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => {
                        if (confirm("Snapshot löschen?")) deleteSnapshotMutation.mutate(snapshot.id);
                      }} title="Löschen">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
