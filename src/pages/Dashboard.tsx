import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { KPICard } from "@/components/crm/KPICard";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { Users, Handshake, Euro, CalendarCheck, Mic, Phone, Clock, Upload, TrendingUp, BadgeEuro } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useState } from "react";
import { runSeed } from "@/lib/seedDatabase";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

const stageLabels: Record<string, string> = {
  lead: "Lead", qualified: "Qualifiziert", proposal: "Angebot",
  negotiation: "Verhandlung", won: "Gewonnen", lost: "Verloren",
};
const stageColors = ["#3b82f6", "#8b5cf6", "#f97316", "#eab308", "#22c55e", "#ef4444"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(value);
}

export default function Dashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [seeding, setSeeding] = useState(false);

  const { data: companyCount = 0 } = useQuery({
    queryKey: ["companies-count"],
    queryFn: async () => {
      const { count } = await supabase.from("companies").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const handleSeed = async () => {
    if (!user) return;
    setSeeding(true);
    try {
      const result = await runSeed(user.id);
      toast.success(`${result.companiesInserted} Unternehmen und ${result.dealsInserted} Deals importiert`);
      queryClient.invalidateQueries();
    } catch (e: any) {
      toast.error("Import fehlgeschlagen: " + e.message);
    } finally {
      setSeeding(false);
    }
  };

  const { data: contactCount = 0 } = useQuery({
    queryKey: ["contacts-count"],
    queryFn: async () => {
      const { count } = await supabase.from("contacts").select("*", { count: "exact", head: true });
      return count || 0;
    },
  });

  const { data: deals = [] } = useQuery({
    queryKey: ["deals-all"],
    queryFn: async () => {
      const { data } = await supabase.from("deals").select("*");
      return data || [];
    },
  });

  const { data: activitiesToday = 0 } = useQuery({
    queryKey: ["activities-today"],
    queryFn: async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      const { count } = await supabase
        .from("activities")
        .select("*", { count: "exact", head: true })
        .gte("due_date", today.toISOString())
        .lt("due_date", tomorrow.toISOString())
        .is("completed_at", null);
      return count || 0;
    },
  });

  const { data: recentActivities = [] } = useQuery({
    queryKey: ["recent-activities"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activities")
        .select("*, contacts(first_name, last_name)")
        .order("created_at", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const { data: voiceLeads = [] } = useQuery({
    queryKey: ["voice-leads-new"],
    queryFn: async () => {
      const { data } = await supabase
        .from("voice_leads")
        .select("*")
        .eq("status", "new")
        .order("created_at", { ascending: false })
        .limit(5);
      return data || [];
    },
  });

  const openDeals = deals.filter((d) => !["won", "lost"].includes(d.stage));
  const pipelineValue = openDeals.reduce((sum, d) => sum + Number(d.value), 0);
  const weightedPipeline = openDeals.reduce((sum, d) => sum + Number(d.value) * (d.probability / 100), 0);
  const wonDeals = deals.filter((d) => d.stage === "won");
  const totalRevenue = wonDeals.reduce((sum, d) => sum + Number(d.value), 0);

  const stageData = ["lead", "qualified", "proposal", "negotiation", "won", "lost"].map((stage) => {
    const stageDeals = deals.filter((d) => d.stage === stage);
    return {
      name: stageLabels[stage],
      count: stageDeals.length,
      value: stageDeals.reduce((s, d) => s + Number(d.value), 0),
    };
  });

  const activityIcons: Record<string, any> = { call: Phone, email: Users, meeting: CalendarCheck, task: CalendarCheck, note: Users };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Dashboard</h1>
        {companyCount === 0 && (
          <Button onClick={handleSeed} disabled={seeding} size="sm" variant="outline" className="gap-2">
            <Upload className="h-4 w-4" />
            {seeding ? "Importiere..." : "Daten importieren"}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KPICard label="Umsatz (Gewonnen)" value={formatCurrency(totalRevenue)} icon={BadgeEuro} />
        <KPICard label="Pipeline-Wert" value={formatCurrency(pipelineValue)} icon={Euro} />
        <KPICard label="Gewichtete Pipeline" value={formatCurrency(weightedPipeline)} icon={TrendingUp} />
        <KPICard label="Offene Deals" value={openDeals.length} icon={Handshake} />
        <KPICard label="Kontakte gesamt" value={contactCount} icon={Users} />
        <KPICard label="Aktivitäten heute" value={activitiesToday} icon={CalendarCheck} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pipeline Chart */}
        <div className="bg-card rounded-lg border border-border p-5">
          <h2 className="text-sm font-medium text-foreground mb-4">Pipeline-Übersicht</h2>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={stageData}>
              <XAxis dataKey="name" tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#9CA3AF", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip
                contentStyle={{ background: "#161616", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 8, color: "#fff" }}
                formatter={(value: number) => [value, "Deals"]}
              />
              <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                {stageData.map((_, i) => (
                  <Cell key={i} fill={stageColors[i]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Recent Activities */}
        <div className="bg-card rounded-lg border border-border p-5">
          <h2 className="text-sm font-medium text-foreground mb-4">Letzte Aktivitäten</h2>
          {recentActivities.length === 0 ? (
            <p className="text-secondary-foreground text-sm">Keine Aktivitäten vorhanden</p>
          ) : (
            <div className="space-y-3 max-h-[220px] overflow-auto">
              {recentActivities.map((a: any) => {
                const Icon = activityIcons[a.type] || CalendarCheck;
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-md bg-surface flex items-center justify-center shrink-0">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm text-foreground truncate">{a.title}</p>
                      <p className="text-xs text-muted-foreground">
                        {a.contacts ? `${a.contacts.first_name} ${a.contacts.last_name}` : ""} · {format(new Date(a.created_at), "dd.MM.yyyy HH:mm", { locale: de })}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Voice Leads */}
      <div className="bg-card rounded-lg border border-border p-5">
        <div className="flex items-center gap-2 mb-4">
          <Mic className="h-4 w-4 text-primary" />
          <h2 className="text-sm font-medium text-foreground">Neue Voice AI Leads</h2>
        </div>
        {voiceLeads.length === 0 ? (
          <p className="text-secondary-foreground text-sm">Keine neuen Voice Leads</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {voiceLeads.map((vl: any) => (
              <div key={vl.id} className="bg-surface rounded-lg p-4 border border-border">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-foreground">{vl.caller_name}</span>
                  <StatusBadge status={vl.intent} />
                </div>
                <p className="text-xs text-secondary-foreground line-clamp-2 mb-2">{vl.summary || "Keine Zusammenfassung"}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{vl.caller_phone}</span>
                  <span className="text-xs text-primary font-medium">Score: {vl.ai_score}</span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
