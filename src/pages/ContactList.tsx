import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { ContactAvatar } from "@/components/crm/ContactAvatar";
import { EmptyState } from "@/components/crm/EmptyState";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { Plus, Search, Users } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { useDebounce } from "@/hooks/useDebounce";

export default function ContactList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [dialogOpen, setDialogOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: companies = [] } = useQuery({
    queryKey: ["companies-select"],
    queryFn: async () => {
      const { data } = await supabase.from("companies").select("id, name").order("name");
      return data || [];
    },
  });

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["contacts", debouncedSearch, statusFilter, sourceFilter],
    queryFn: async () => {
      let q = supabase.from("contacts").select("*, companies(name)").order("created_at", { ascending: false });
      if (debouncedSearch) q = q.or(`first_name.ilike.%${debouncedSearch}%,last_name.ilike.%${debouncedSearch}%,email.ilike.%${debouncedSearch}%`);
      if (statusFilter !== "all") q = q.eq("status", statusFilter as any);
      if (sourceFilter !== "all") q = q.eq("source", sourceFilter as any);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { error } = await supabase.from("contacts").insert({
        first_name: formData.get("first_name") as string,
        last_name: formData.get("last_name") as string,
        email: formData.get("email") as string || null,
        phone: formData.get("phone") as string || null,
        position: formData.get("position") as string || null,
        company_id: formData.get("company_id") as string || null,
        source: (formData.get("source") as any) || "manual",
        status: "lead",
        owner_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success("Kontakt erstellt");
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Kontakte</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md">
              <Plus className="h-4 w-4 mr-1" /> Neuer Kontakt
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border max-h-[90vh] overflow-y-auto">
            <DialogHeader><DialogTitle className="text-foreground">Neuer Kontakt</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-secondary-foreground">Vorname</Label><Input name="first_name" required className="bg-surface border-border rounded-md" /></div>
                <div><Label className="text-secondary-foreground">Nachname</Label><Input name="last_name" required className="bg-surface border-border rounded-md" /></div>
              </div>
              <div><Label className="text-secondary-foreground">E-Mail</Label><Input name="email" type="email" className="bg-surface border-border rounded-md" /></div>
              <div><Label className="text-secondary-foreground">Telefon</Label><Input name="phone" className="bg-surface border-border rounded-md" /></div>
              <div><Label className="text-secondary-foreground">Position</Label><Input name="position" className="bg-surface border-border rounded-md" /></div>
              <div><Label className="text-secondary-foreground">Unternehmen</Label>
                <Select name="company_id">
                  <SelectTrigger className="bg-surface border-border rounded-md"><SelectValue placeholder="Optional" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {companies.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-secondary-foreground">Quelle</Label>
                <Select name="source" defaultValue="manual">
                  <SelectTrigger className="bg-surface border-border rounded-md"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="manual">Manuell</SelectItem>
                    <SelectItem value="website">Website</SelectItem>
                    <SelectItem value="referral">Empfehlung</SelectItem>
                    <SelectItem value="voice_ai">Voice AI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createMutation.isPending} className="w-full bg-primary text-primary-foreground rounded-md">
                {createMutation.isPending ? "Wird erstellt..." : "Kontakt erstellen"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Kontakte suchen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border rounded-md" />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[150px] bg-card border-border rounded-md"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="lead">Lead</SelectItem>
            <SelectItem value="prospect">Interessent</SelectItem>
            <SelectItem value="customer">Kunde</SelectItem>
            <SelectItem value="inactive">Inaktiv</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-full sm:w-[150px] bg-card border-border rounded-md"><SelectValue placeholder="Quelle" /></SelectTrigger>
          <SelectContent className="bg-card border-border">
            <SelectItem value="all">Alle Quellen</SelectItem>
            <SelectItem value="manual">Manuell</SelectItem>
            <SelectItem value="website">Website</SelectItem>
            <SelectItem value="referral">Empfehlung</SelectItem>
            <SelectItem value="voice_ai">Voice AI</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      {contacts.length === 0 && !isLoading ? (
        <EmptyState icon={Users} title="Keine Kontakte" description="Erstelle deinen ersten Kontakt, um loszulegen." />
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Unternehmen</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden lg:table-cell">E-Mail</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden lg:table-cell">Telefon</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Quelle</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map((c: any) => (
                  <tr key={c.id} onClick={() => navigate(`/contacts/${c.id}`)} className="border-b border-border hover:bg-surface cursor-pointer transition-colors">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <ContactAvatar firstName={c.first_name} lastName={c.last_name} />
                        <span className="text-sm text-foreground font-medium">{c.first_name} {c.last_name}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-secondary-foreground hidden md:table-cell">{c.companies?.name || "—"}</td>
                    <td className="px-4 py-3 text-sm text-secondary-foreground hidden lg:table-cell">{c.email || "—"}</td>
                    <td className="px-4 py-3 text-sm text-secondary-foreground hidden lg:table-cell">{c.phone || "—"}</td>
                    <td className="px-4 py-3"><StatusBadge status={c.status} /></td>
                    <td className="px-4 py-3 hidden md:table-cell"><StatusBadge status={c.source} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
