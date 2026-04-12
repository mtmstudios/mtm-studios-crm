import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { EmptyState } from "@/components/crm/EmptyState";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Mic, UserPlus, X } from "lucide-react";

export default function VoiceLeads() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState("all");

  const { data: leads = [], isLoading } = useQuery({
    queryKey: ["voice-leads", statusFilter],
    queryFn: async () => {
      let q = supabase.from("voice_leads").select("*").order("created_at", { ascending: false });
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const convertMutation = useMutation({
    mutationFn: async (lead: any) => {
      const nameParts = (lead.caller_name || "Unbekannt").split(" ");
      const firstName = nameParts[0] || "Unbekannt";
      const lastName = nameParts.slice(1).join(" ") || "";

      const { data: contact, error: contactError } = await supabase.from("contacts").insert({
        first_name: firstName,
        last_name: lastName || "—",
        phone: lead.caller_phone,
        source: "voice_ai" as const,
        status: "lead" as const,
        owner_id: user!.id,
        notes: lead.summary || lead.transcript || null,
      }).select().single();
      if (contactError) throw contactError;

      const { error: updateError } = await supabase.from("voice_leads").update({
        status: "converted" as const,
        converted_contact_id: contact.id,
      }).eq("id", lead.id);
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-leads"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Lead in Kontakt umgewandelt");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const dismissMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("voice_leads").update({ status: "dismissed" as const }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["voice-leads"] });
      toast.success("Lead abgelehnt");
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <h1 className="text-xl font-semibold text-foreground">Voice AI Leads</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px] bg-card border-border rounded-md"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Alle</SelectItem>
            <SelectItem value="new">Neu</SelectItem>
            <SelectItem value="contacted">Kontaktiert</SelectItem>
            <SelectItem value="converted">Konvertiert</SelectItem>
            <SelectItem value="dismissed">Abgelehnt</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {leads.length === 0 && !isLoading ? (
        <EmptyState icon={Mic} title="Keine Voice Leads" description="Sobald Voice AI Anrufe eingehen, erscheinen sie hier." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {leads.map((lead: any) => (
            <div key={lead.id} className="bg-card rounded-lg border border-border p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-foreground">{lead.caller_name}</h3>
                <StatusBadge status={lead.status} />
              </div>
              {lead.caller_phone && <p className="text-xs text-secondary-foreground">{lead.caller_phone}</p>}
              {lead.summary && <p className="text-xs text-secondary-foreground line-clamp-3">{lead.summary}</p>}
              <div className="flex items-center justify-between">
                <StatusBadge status={lead.intent} />
                <span className="text-sm text-primary font-medium">Score: {lead.ai_score}</span>
              </div>
              {lead.transcript && (
                <details className="text-xs">
                  <summary className="text-muted-foreground cursor-pointer hover:text-foreground">Transkript anzeigen</summary>
                  <p className="text-secondary-foreground mt-2 bg-surface rounded-md p-3 max-h-32 overflow-auto">{lead.transcript}</p>
                </details>
              )}
              {lead.status === "new" && (
                <div className="flex gap-2 pt-1">
                  <Button size="sm" onClick={() => convertMutation.mutate(lead)} disabled={convertMutation.isPending} className="flex-1 bg-success text-success-foreground rounded-md text-xs">
                    <UserPlus className="h-3 w-3 mr-1" /> In Kontakt umwandeln
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => dismissMutation.mutate(lead.id)} disabled={dismissMutation.isPending} className="text-muted-foreground hover:text-destructive">
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
