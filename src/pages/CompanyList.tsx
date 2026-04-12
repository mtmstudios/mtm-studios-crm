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
import { Plus, Search, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useDebounce } from "@/hooks/useDebounce";

const sizeLabels: Record<string, string> = { startup: "Startup", smb: "KMU", mid_market: "Mittelstand", enterprise: "Konzern" };

export default function CompanyList() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const debouncedSearch = useDebounce(search, 300);

  const { data: companies = [], isLoading } = useQuery({
    queryKey: ["companies", debouncedSearch],
    queryFn: async () => {
      let q = supabase.from("companies").select("*").order("created_at", { ascending: false });
      if (debouncedSearch) q = q.ilike("name", `%${debouncedSearch}%`);
      const { data, error } = await q;
      if (error) throw error;
      return data || [];
    },
  });

  const createMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const { error } = await supabase.from("companies").insert({
        name: formData.get("name") as string,
        website: formData.get("website") as string || null,
        industry: formData.get("industry") as string || null,
        size: (formData.get("size") as any) || null,
        country: formData.get("country") as string || null,
        city: formData.get("city") as string || null,
        owner_id: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      toast.success("Unternehmen erstellt");
      setDialogOpen(false);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Unternehmen</h1>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md"><Plus className="h-4 w-4 mr-1" /> Neues Unternehmen</Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle className="text-foreground">Neues Unternehmen</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createMutation.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
              <div><Label className="text-secondary-foreground">Name</Label><Input name="name" required className="bg-surface border-border rounded-md" /></div>
              <div><Label className="text-secondary-foreground">Website</Label><Input name="website" className="bg-surface border-border rounded-md" /></div>
              <div><Label className="text-secondary-foreground">Branche</Label><Input name="industry" className="bg-surface border-border rounded-md" /></div>
              <div><Label className="text-secondary-foreground">Größe</Label>
                <Select name="size">
                  <SelectTrigger className="bg-surface border-border rounded-md"><SelectValue placeholder="Auswählen" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="startup">Startup</SelectItem>
                    <SelectItem value="smb">KMU</SelectItem>
                    <SelectItem value="mid_market">Mittelstand</SelectItem>
                    <SelectItem value="enterprise">Konzern</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div><Label className="text-secondary-foreground">Land</Label><Input name="country" className="bg-surface border-border rounded-md" /></div>
                <div><Label className="text-secondary-foreground">Stadt</Label><Input name="city" className="bg-surface border-border rounded-md" /></div>
              </div>
              <Button type="submit" disabled={createMutation.isPending} className="w-full bg-primary text-primary-foreground rounded-md">
                {createMutation.isPending ? "Wird erstellt..." : "Erstellen"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Unternehmen suchen..." value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9 bg-card border-border rounded-md" />
      </div>

      {companies.length === 0 && !isLoading ? (
        <EmptyState icon={Building2} title="Keine Unternehmen" description="Erstelle dein erstes Unternehmen." />
      ) : (
        <div className="bg-card rounded-lg border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase">Name</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Branche</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden md:table-cell">Größe</th>
                  <th className="text-left px-4 py-3 text-xs font-medium text-muted-foreground uppercase hidden lg:table-cell">Stadt</th>
                </tr>
              </thead>
              <tbody>
                {companies.map((c: any) => (
                  <tr key={c.id} onClick={() => navigate(`/companies/${c.id}`)} className="border-b border-border hover:bg-surface cursor-pointer transition-colors">
                    <td className="px-4 py-3 text-sm text-foreground font-medium">{c.name}</td>
                    <td className="px-4 py-3 text-sm text-secondary-foreground hidden md:table-cell">{c.industry || "—"}</td>
                    <td className="px-4 py-3 text-sm text-secondary-foreground hidden md:table-cell">{c.size ? sizeLabels[c.size] : "—"}</td>
                    <td className="px-4 py-3 text-sm text-secondary-foreground hidden lg:table-cell">{c.city || "—"}</td>
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
