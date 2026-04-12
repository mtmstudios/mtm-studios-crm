import { useState, useRef } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";
import { Camera, Upload, Sparkles, Building2, User, Loader2, X, ImagePlus } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface ExtractedData {
  company_name: string;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  website: string;
  position: string;
  city: string;
  industry: string;
}

const emptyData: ExtractedData = {
  company_name: "", first_name: "", last_name: "", email: "",
  phone: "", website: "", position: "", city: "", industry: "",
};

export default function ScanImport() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [data, setData] = useState<ExtractedData>(emptyData);
  const [extracting, setExtracting] = useState(false);
  const [companyStatus, setCompanyStatus] = useState("lead");

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file || !file.type.startsWith("image/")) return;
    setImageFile(file);
    const url = URL.createObjectURL(file);
    setImageUrl(url);
  };

  const handleExtractAI = async () => {
    if (!imageFile) return;
    setExtracting(true);
    try {
      // Upload image to Supabase Storage (temp bucket)
      const fileName = `scan_${Date.now()}_${imageFile.name}`;
      const { error: uploadError } = await supabase.storage
        .from("scans")
        .upload(fileName, imageFile, { contentType: imageFile.type });

      if (uploadError) {
        // Storage bucket might not exist yet — show hint
        toast.error("Upload fehlgeschlagen. Bitte erstelle den 'scans' Storage Bucket in Supabase.");
        setExtracting(false);
        return;
      }

      const { data: urlData } = supabase.storage.from("scans").getPublicUrl(fileName);

      // Call Edge Function for AI extraction
      const { data: result, error } = await supabase.functions.invoke("extract-contact", {
        body: { image_url: urlData.publicUrl },
      });

      if (error) {
        toast.error("KI-Extraktion nicht verfügbar. Bitte manuell ausfüllen.");
        setExtracting(false);
        return;
      }

      if (result) {
        setData({
          company_name: result.company_name || "",
          first_name: result.first_name || "",
          last_name: result.last_name || "",
          email: result.email || "",
          phone: result.phone || "",
          website: result.website || "",
          position: result.position || "",
          city: result.city || "",
          industry: result.industry || "",
        });
        toast.success("Daten extrahiert! Bitte prüfen und bestätigen.");
      }
    } catch {
      toast.error("KI-Extraktion fehlgeschlagen. Bitte manuell ausfüllen.");
    } finally {
      setExtracting(false);
    }
  };

  const clearImage = () => {
    setImageUrl(null);
    setImageFile(null);
    setData(emptyData);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      if (!data.company_name.trim()) throw new Error("Firmenname ist Pflicht");

      // Create company
      const { data: company, error: companyError } = await supabase
        .from("companies")
        .insert({
          name: data.company_name.trim(),
          website: data.website || null,
          city: data.city || null,
          industry: data.industry || null,
          status: companyStatus as any,
          owner_id: user!.id,
        })
        .select()
        .single();

      if (companyError) throw companyError;

      // Create contact if name given
      if (data.first_name.trim() || data.last_name.trim()) {
        const { error: contactError } = await supabase.from("contacts").insert({
          first_name: data.first_name.trim() || "—",
          last_name: data.last_name.trim() || "—",
          email: data.email || null,
          phone: data.phone || null,
          position: data.position || null,
          company_id: company.id,
          source: "manual" as const,
          status: companyStatus === "customer" ? "customer" as const : "lead" as const,
          owner_id: user!.id,
        });
        if (contactError) throw contactError;
      }

      return company;
    },
    onSuccess: (company) => {
      queryClient.invalidateQueries({ queryKey: ["companies"] });
      queryClient.invalidateQueries({ queryKey: ["contacts"] });
      toast.success(`"${company.name}" erstellt!`);
      navigate(`/companies/${company.id}`);
    },
    onError: (e: any) => toast.error(e.message),
  });

  const updateField = (field: keyof ExtractedData, value: string) => {
    setData((prev) => ({ ...prev, [field]: value }));
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl font-semibold text-foreground">Scan & Import</h1>
        <p className="text-sm text-secondary-foreground mt-1">Visitenkarte oder Google My Business Screenshot hochladen → Unternehmen + Kontakt erstellen</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Left: Image Upload */}
        <div className="space-y-4">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleImageSelect}
            className="hidden"
          />

          {!imageUrl ? (
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              className="bg-card rounded-lg border-2 border-dashed border-border hover:border-primary/40 p-12 flex flex-col items-center justify-center cursor-pointer transition-colors min-h-[300px]"
            >
              <ImagePlus className="h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-sm text-foreground font-medium">Bild hochladen</p>
              <p className="text-xs text-muted-foreground mt-1">Klicken, Foto machen oder Drag & Drop</p>
              <div className="flex gap-3 mt-4">
                <span className="text-xs bg-surface px-3 py-1 rounded-pill text-muted-foreground">Visitenkarte</span>
                <span className="text-xs bg-surface px-3 py-1 rounded-pill text-muted-foreground">GMB Screenshot</span>
                <span className="text-xs bg-surface px-3 py-1 rounded-pill text-muted-foreground">Website</span>
              </div>
            </div>
          ) : (
            <div className="relative bg-card rounded-lg border border-border overflow-hidden">
              <button
                onClick={clearImage}
                className="absolute top-3 right-3 z-10 bg-background/80 rounded-full p-1.5 hover:bg-background transition-colors"
              >
                <X className="h-4 w-4 text-foreground" />
              </button>
              <img src={imageUrl} alt="Upload" className="w-full max-h-[400px] object-contain" />
            </div>
          )}

          {imageUrl && (
            <div className="flex gap-2">
              <Button onClick={() => fileInputRef.current?.click()} variant="outline" className="flex-1 border-border">
                <Camera className="h-4 w-4 mr-2" /> Anderes Bild
              </Button>
              <Button onClick={handleExtractAI} disabled={extracting} className="flex-1 bg-primary text-primary-foreground">
                {extracting ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
                {extracting ? "Extrahiere..." : "KI Erkennung"}
              </Button>
            </div>
          )}
        </div>

        {/* Right: Form */}
        <div className="space-y-4">
          <div className="bg-card rounded-lg border border-border p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Building2 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium text-foreground">Unternehmen</h2>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Firmenname *</Label>
              <Input value={data.company_name} onChange={(e) => updateField("company_name", e.target.value)} placeholder="z.B. Muster GmbH" className="bg-surface border-border rounded-md mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground text-xs">Status</Label>
                <Select value={companyStatus} onValueChange={setCompanyStatus}>
                  <SelectTrigger className="bg-surface border-border rounded-md mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="lead">Lead</SelectItem>
                    <SelectItem value="prospect">Interessent</SelectItem>
                    <SelectItem value="customer">Kunde</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Branche</Label>
                <Input value={data.industry} onChange={(e) => updateField("industry", e.target.value)} placeholder="z.B. Gesundheit" className="bg-surface border-border rounded-md mt-1" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground text-xs">Website</Label>
                <Input value={data.website} onChange={(e) => updateField("website", e.target.value)} placeholder="https://..." className="bg-surface border-border rounded-md mt-1" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Stadt</Label>
                <Input value={data.city} onChange={(e) => updateField("city", e.target.value)} placeholder="z.B. Stuttgart" className="bg-surface border-border rounded-md mt-1" />
              </div>
            </div>
          </div>

          <div className="bg-card rounded-lg border border-border p-5 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <User className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium text-foreground">Kontakt (optional)</h2>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground text-xs">Vorname</Label>
                <Input value={data.first_name} onChange={(e) => updateField("first_name", e.target.value)} className="bg-surface border-border rounded-md mt-1" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Nachname</Label>
                <Input value={data.last_name} onChange={(e) => updateField("last_name", e.target.value)} className="bg-surface border-border rounded-md mt-1" />
              </div>
            </div>
            <div>
              <Label className="text-muted-foreground text-xs">Position</Label>
              <Input value={data.position} onChange={(e) => updateField("position", e.target.value)} placeholder="z.B. Geschäftsführer" className="bg-surface border-border rounded-md mt-1" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-muted-foreground text-xs">E-Mail</Label>
                <Input value={data.email} onChange={(e) => updateField("email", e.target.value)} type="email" className="bg-surface border-border rounded-md mt-1" />
              </div>
              <div>
                <Label className="text-muted-foreground text-xs">Telefon</Label>
                <Input value={data.phone} onChange={(e) => updateField("phone", e.target.value)} className="bg-surface border-border rounded-md mt-1" />
              </div>
            </div>
          </div>

          <Button
            onClick={() => createMutation.mutate()}
            disabled={createMutation.isPending || !data.company_name.trim()}
            className="w-full bg-primary text-primary-foreground rounded-md h-11"
          >
            {createMutation.isPending ? (
              <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Wird erstellt...</>
            ) : (
              <><Upload className="h-4 w-4 mr-2" /> Unternehmen {data.first_name ? "+ Kontakt " : ""}erstellen</>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
