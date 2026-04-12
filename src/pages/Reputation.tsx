import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Star, Send, Plus, ExternalLink, MessageSquare, TrendingUp, Users } from "lucide-react";
import { toast } from "sonner";
import { KPICard } from "@/components/crm/KPICard";

const platformLabels: Record<string, string> = {
  google: "Google",
  trustpilot: "Trustpilot",
  yelp: "Yelp",
  facebook: "Facebook",
};

const statusLabels: Record<string, string> = {
  pending: "Ausstehend",
  sent: "Gesendet",
  completed: "Abgeschlossen",
  declined: "Abgelehnt",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500",
  sent: "bg-blue-500/10 text-blue-500",
  completed: "bg-green-500/10 text-green-500",
  declined: "bg-red-500/10 text-red-500",
};

export default function Reputation() {
  const queryClient = useQueryClient();
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [requestDialogOpen, setRequestDialogOpen] = useState(false);

  // Form states
  const [newReview, setNewReview] = useState({ author_name: "", rating: 5, content: "", platform: "google", review_url: "" });
  const [newRequest, setNewRequest] = useState({ contact_name: "", contact_email: "", contact_phone: "", platform: "google", review_url: "" });

  const { data: reviews = [] } = useQuery({
    queryKey: ["reviews"],
    queryFn: async () => {
      const { data, error } = await supabase.from("reviews").select("*").order("review_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: requests = [] } = useQuery({
    queryKey: ["review_requests"],
    queryFn: async () => {
      const { data, error } = await supabase.from("review_requests").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const avgRating = reviews.length > 0 ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1) : "–";
  const totalReviews = reviews.length;
  const positiveRate = reviews.length > 0 ? Math.round((reviews.filter(r => r.rating >= 4).length / reviews.length) * 100) : 0;
  const pendingRequests = requests.filter(r => r.status === "pending" || r.status === "sent").length;

  const addReviewMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("reviews").insert({ ...newReview, owner_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["reviews"] });
      setReviewDialogOpen(false);
      setNewReview({ author_name: "", rating: 5, content: "", platform: "google", review_url: "" });
      toast.success("Bewertung hinzugefügt");
    },
    onError: (e) => toast.error(e.message),
  });

  const addRequestMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Nicht angemeldet");
      const { error } = await supabase.from("review_requests").insert({ ...newRequest, owner_id: user.id });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review_requests"] });
      setRequestDialogOpen(false);
      setNewRequest({ contact_name: "", contact_email: "", contact_phone: "", platform: "google", review_url: "" });
      toast.success("Bewertungsanfrage erstellt");
    },
    onError: (e) => toast.error(e.message),
  });

  const sendRequestMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("review_requests").update({ status: "sent" as any, sent_at: new Date().toISOString() }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["review_requests"] });
      toast.success("Anfrage als gesendet markiert");
    },
  });

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-4 w-4 ${i <= rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`} />
      ))}
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Reputation Management</h1>
          <p className="text-sm text-muted-foreground">Bewertungen verwalten & Anfragen senden</p>
        </div>
        <div className="flex gap-2">
          <Dialog open={requestDialogOpen} onOpenChange={setRequestDialogOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm"><Send className="h-4 w-4 mr-2" />Anfrage senden</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Bewertungsanfrage erstellen</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Kontaktname *" value={newRequest.contact_name} onChange={e => setNewRequest(p => ({ ...p, contact_name: e.target.value }))} />
                <Input placeholder="E-Mail" value={newRequest.contact_email} onChange={e => setNewRequest(p => ({ ...p, contact_email: e.target.value }))} />
                <Input placeholder="Telefon" value={newRequest.contact_phone} onChange={e => setNewRequest(p => ({ ...p, contact_phone: e.target.value }))} />
                <Select value={newRequest.platform} onValueChange={v => setNewRequest(p => ({ ...p, platform: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(platformLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Bewertungs-URL" value={newRequest.review_url} onChange={e => setNewRequest(p => ({ ...p, review_url: e.target.value }))} />
                <Button className="w-full" onClick={() => addRequestMutation.mutate()} disabled={!newRequest.contact_name}>Erstellen</Button>
              </div>
            </DialogContent>
          </Dialog>
          <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-2" />Bewertung hinzufügen</Button>
            </DialogTrigger>
            <DialogContent className="bg-card border-border">
              <DialogHeader><DialogTitle>Bewertung manuell erfassen</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="Autor *" value={newReview.author_name} onChange={e => setNewReview(p => ({ ...p, author_name: e.target.value }))} />
                <Select value={newReview.platform} onValueChange={v => setNewReview(p => ({ ...p, platform: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>{Object.entries(platformLabels).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-muted-foreground">Bewertung:</span>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(i => (
                      <button key={i} onClick={() => setNewReview(p => ({ ...p, rating: i }))}>
                        <Star className={`h-5 w-5 ${i <= newReview.rating ? "text-yellow-400 fill-yellow-400" : "text-muted-foreground/30"}`} />
                      </button>
                    ))}
                  </div>
                </div>
                <Textarea placeholder="Bewertungstext" value={newReview.content} onChange={e => setNewReview(p => ({ ...p, content: e.target.value }))} />
                <Input placeholder="URL zur Bewertung" value={newReview.review_url} onChange={e => setNewReview(p => ({ ...p, review_url: e.target.value }))} />
                <Button className="w-full" onClick={() => addReviewMutation.mutate()} disabled={!newReview.author_name}>Speichern</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KPICard title="Ø Bewertung" value={String(avgRating)} icon={Star} />
        <KPICard title="Bewertungen" value={String(totalReviews)} icon={MessageSquare} />
        <KPICard title="Positiv-Rate" value={`${positiveRate}%`} icon={TrendingUp} />
        <KPICard title="Offene Anfragen" value={String(pendingRequests)} icon={Users} />
      </div>

      <Tabs defaultValue="reviews">
        <TabsList className="bg-surface">
          <TabsTrigger value="reviews">Bewertungen</TabsTrigger>
          <TabsTrigger value="requests">Anfragen</TabsTrigger>
        </TabsList>

        <TabsContent value="reviews" className="space-y-3 mt-4">
          {reviews.length === 0 ? (
            <Card className="bg-card border-border"><CardContent className="p-8 text-center text-muted-foreground">Noch keine Bewertungen erfasst.</CardContent></Card>
          ) : reviews.map(review => (
            <Card key={review.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{review.author_name}</span>
                      <Badge variant="outline" className="text-xs">{platformLabels[review.platform] || review.platform}</Badge>
                    </div>
                    {renderStars(review.rating)}
                    {review.content && <p className="text-sm text-muted-foreground mt-2">{review.content}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    {review.review_url && (
                      <a href={review.review_url} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                      </a>
                    )}
                    <span className="text-xs text-muted-foreground">{new Date(review.review_date).toLocaleDateString("de-DE")}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="requests" className="space-y-3 mt-4">
          {requests.length === 0 ? (
            <Card className="bg-card border-border"><CardContent className="p-8 text-center text-muted-foreground">Noch keine Anfragen erstellt.</CardContent></Card>
          ) : requests.map(req => (
            <Card key={req.id} className="bg-card border-border">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-foreground">{req.contact_name}</span>
                      <Badge variant="outline" className="text-xs">{platformLabels[req.platform] || req.platform}</Badge>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[req.status]}`}>{statusLabels[req.status]}</span>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {req.contact_email || req.contact_phone || "Kein Kontakt"}
                      {req.sent_at && ` · Gesendet: ${new Date(req.sent_at).toLocaleDateString("de-DE")}`}
                    </p>
                  </div>
                  {req.status === "pending" && (
                    <Button variant="outline" size="sm" onClick={() => sendRequestMutation.mutate(req.id)}>
                      <Send className="h-3 w-3 mr-1" />Senden
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
