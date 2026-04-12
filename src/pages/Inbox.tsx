import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { EmptyState } from "@/components/crm/EmptyState";
import { StatusBadge } from "@/components/crm/StatusBadge";
import { toast } from "sonner";
import { MessageSquare, Send, Plus, ArrowLeft, Phone, User, Smartphone } from "lucide-react";
import { format } from "date-fns";
import { de } from "date-fns/locale";
import { cn } from "@/lib/utils";

export default function Inbox() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedConvoId, setSelectedConvoId] = useState<string | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [newConvoOpen, setNewConvoOpen] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Conversations list
  const { data: conversations = [] } = useQuery({
    queryKey: ["conversations"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("*, contacts(first_name, last_name, status, email, phone)")
        .order("last_message_at", { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  // Messages for selected conversation
  const { data: messages = [] } = useQuery({
    queryKey: ["messages", selectedConvoId],
    enabled: !!selectedConvoId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", selectedConvoId!)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data || [];
    },
  });

  // Contacts for new conversation
  const { data: contacts = [] } = useQuery({
    queryKey: ["contacts-select"],
    queryFn: async () => {
      const { data } = await supabase.from("contacts").select("id, first_name, last_name, phone");
      return data || [];
    },
  });

  // Realtime subscriptions
  useEffect(() => {
    const channel = supabase
      .channel("inbox-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "messages" }, () => {
        queryClient.invalidateQueries({ queryKey: ["messages", selectedConvoId] });
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "conversations" }, () => {
        queryClient.invalidateQueries({ queryKey: ["conversations"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [selectedConvoId, queryClient]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark as read
  useEffect(() => {
    if (!selectedConvoId) return;
    const convo = conversations.find((c) => c.id === selectedConvoId);
    if (convo && convo.unread_count > 0) {
      supabase.from("conversations").update({ unread_count: 0 }).eq("id", selectedConvoId).then();
    }
  }, [selectedConvoId, conversations]);

  // Send message
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (!selectedConvoId || !newMessage.trim()) return;
      // Insert message locally
      const { error } = await supabase.from("messages").insert({
        conversation_id: selectedConvoId,
        direction: "outbound" as any,
        content: newMessage.trim(),
        status: "sent" as any,
      });
      if (error) throw error;
      // Update conversation preview
      await supabase.from("conversations").update({
        last_message_at: new Date().toISOString(),
        last_message_preview: newMessage.trim().slice(0, 100),
      }).eq("id", selectedConvoId);

      // Try sending via Twilio edge function
      const convo = conversations.find((c) => c.id === selectedConvoId);
      if (convo?.contact_phone) {
        try {
          await supabase.functions.invoke("send-sms", {
            body: {
              to: convo.contact_phone,
              message: newMessage.trim(),
              channel: convo.channel,
            },
          });
        } catch {
          // SMS sending may fail if Twilio isn't configured yet - message is still saved
          console.warn("SMS delivery failed - Twilio may not be configured");
        }
      }
    },
    onSuccess: () => {
      setNewMessage("");
      queryClient.invalidateQueries({ queryKey: ["messages", selectedConvoId] });
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Create new conversation
  const createConvoMutation = useMutation({
    mutationFn: async (formData: FormData) => {
      const contactId = formData.get("contact_id") as string;
      const phone = formData.get("phone") as string;
      const channel = (formData.get("channel") as string) || "sms";
      const contact = contacts.find((c: any) => c.id === contactId);

      const { data, error } = await supabase.from("conversations").insert({
        owner_id: user!.id,
        contact_id: contactId || null,
        channel: channel as any,
        contact_phone: phone || contact?.phone || null,
        contact_name: contact ? `${contact.first_name} ${contact.last_name}` : phone,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["conversations"] });
      setSelectedConvoId(data.id);
      setNewConvoOpen(false);
      toast.success("Unterhaltung erstellt");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const selectedConvo = conversations.find((c) => c.id === selectedConvoId);
  const totalUnread = conversations.reduce((sum, c) => sum + (c.unread_count || 0), 0);

  return (
    <div className="animate-fade-in h-[calc(100vh-7rem)] md:h-[calc(100vh-3rem)] flex flex-col">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-semibold text-foreground">
          Posteingang {totalUnread > 0 && <span className="text-xs bg-primary text-primary-foreground px-1.5 py-0.5 rounded-full ml-1">{totalUnread}</span>}
        </h1>
        <Dialog open={newConvoOpen} onOpenChange={setNewConvoOpen}>
          <DialogTrigger asChild>
            <Button className="bg-primary text-primary-foreground hover:bg-primary/90 rounded-md" size="sm">
              <Plus className="h-4 w-4 mr-1" /> Neue Nachricht
            </Button>
          </DialogTrigger>
          <DialogContent className="bg-card border-border">
            <DialogHeader><DialogTitle className="text-foreground">Neue Unterhaltung</DialogTitle></DialogHeader>
            <form onSubmit={(e) => { e.preventDefault(); createConvoMutation.mutate(new FormData(e.currentTarget)); }} className="space-y-3">
              <div><Label className="text-secondary-foreground">Kontakt</Label>
                <Select name="contact_id">
                  <SelectTrigger className="bg-surface border-border rounded-md"><SelectValue placeholder="Kontakt wählen" /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {contacts.filter((c: any) => c.phone).map((c: any) => (
                      <SelectItem key={c.id} value={c.id}>{c.first_name} {c.last_name} ({c.phone})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div><Label className="text-secondary-foreground">Oder Telefonnummer</Label>
                <Input name="phone" placeholder="+49..." className="bg-surface border-border rounded-md" />
              </div>
              <div><Label className="text-secondary-foreground">Kanal</Label>
                <Select name="channel" defaultValue="sms">
                  <SelectTrigger className="bg-surface border-border rounded-md"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="sms"><span className="flex items-center gap-2"><Smartphone className="h-3.5 w-3.5" /> SMS</span></SelectItem>
                    <SelectItem value="whatsapp"><span className="flex items-center gap-2"><MessageSquare className="h-3.5 w-3.5" /> WhatsApp</span></SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button type="submit" disabled={createConvoMutation.isPending} className="w-full bg-primary text-primary-foreground rounded-md">
                Unterhaltung starten
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="flex-1 flex border border-border rounded-lg overflow-hidden bg-card min-h-0">
        {/* Conversation list */}
        <div className={cn(
          "w-full md:w-80 border-r border-border flex flex-col shrink-0 overflow-y-auto",
          selectedConvoId ? "hidden md:flex" : "flex"
        )}>
          {conversations.length === 0 ? (
            <div className="flex-1 flex items-center justify-center p-4">
              <EmptyState icon={MessageSquare} title="Keine Unterhaltungen" description="Starte eine neue Nachricht." />
            </div>
          ) : (
            conversations.map((convo) => (
              <button
                key={convo.id}
                onClick={() => setSelectedConvoId(convo.id)}
                className={cn(
                  "w-full text-left p-3 border-b border-border flex items-start gap-3 transition-colors",
                  selectedConvoId === convo.id ? "bg-primary/5" : "hover:bg-surface"
                )}
              >
                <div className="w-9 h-9 rounded-full bg-primary/20 flex items-center justify-center shrink-0">
                  {convo.channel === "whatsapp" ? (
                    <MessageSquare className="h-4 w-4 text-primary" />
                  ) : (
                    <Smartphone className="h-4 w-4 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-foreground truncate">
                      {convo.contact_name || convo.contact_phone || "Unbekannt"}
                    </p>
                    {convo.unread_count > 0 && (
                      <span className="bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 rounded-full">{convo.unread_count}</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{convo.last_message_preview || "Keine Nachrichten"}</p>
                  <p className="text-[10px] text-muted-foreground mt-0.5">
                    {convo.last_message_at && format(new Date(convo.last_message_at), "dd.MM. HH:mm", { locale: de })}
                  </p>
                </div>
              </button>
            ))
          )}
        </div>

        {/* Chat area */}
        <div className={cn(
          "flex-1 flex flex-col min-w-0",
          !selectedConvoId ? "hidden md:flex" : "flex"
        )}>
          {!selectedConvoId ? (
            <div className="flex-1 flex items-center justify-center">
              <p className="text-sm text-muted-foreground">Wähle eine Unterhaltung aus</p>
            </div>
          ) : (
            <>
              {/* Chat header */}
              <div className="p-3 border-b border-border flex items-center gap-3">
                <button className="md:hidden text-muted-foreground" onClick={() => setSelectedConvoId(null)}>
                  <ArrowLeft className="h-5 w-5" />
                </button>
                <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
                  <User className="h-4 w-4 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">
                    {selectedConvo?.contact_name || selectedConvo?.contact_phone}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    {selectedConvo?.channel === "whatsapp" ? "WhatsApp" : "SMS"}
                    {selectedConvo?.contact_phone && ` · ${selectedConvo.contact_phone}`}
                  </p>
                </div>
                {/* Contact info sidebar trigger */}
                {selectedConvo?.contacts && (
                  <div className="hidden lg:block text-right">
                    <StatusBadge status={(selectedConvo.contacts as any).status} />
                  </div>
                )}
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-2">
                {messages.length === 0 && (
                  <p className="text-xs text-muted-foreground text-center py-8">Noch keine Nachrichten</p>
                )}
                {messages.map((msg) => (
                  <div key={msg.id} className={cn("flex", msg.direction === "outbound" ? "justify-end" : "justify-start")}>
                    <div className={cn(
                      "max-w-[75%] rounded-lg px-3 py-2",
                      msg.direction === "outbound"
                        ? "bg-primary text-primary-foreground"
                        : "bg-surface border border-border text-foreground"
                    )}>
                      <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      <div className={cn(
                        "flex items-center gap-1 mt-1",
                        msg.direction === "outbound" ? "justify-end" : "justify-start"
                      )}>
                        <span className={cn("text-[10px]", msg.direction === "outbound" ? "text-primary-foreground/60" : "text-muted-foreground")}>
                          {format(new Date(msg.created_at), "HH:mm")}
                        </span>
                        {msg.direction === "outbound" && (
                          <span className="text-[10px] text-primary-foreground/60">
                            {msg.status === "delivered" ? "✓✓" : msg.status === "read" ? "✓✓" : msg.status === "failed" ? "✕" : "✓"}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                <div ref={messagesEndRef} />
              </div>

              {/* Message input */}
              <div className="p-3 border-t border-border">
                <form
                  onSubmit={(e) => { e.preventDefault(); sendMutation.mutate(); }}
                  className="flex gap-2"
                >
                  <Input
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    placeholder="Nachricht schreiben..."
                    className="bg-surface border-border rounded-md flex-1"
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMutation.mutate(); } }}
                  />
                  <Button
                    type="submit"
                    disabled={sendMutation.isPending || !newMessage.trim()}
                    className="bg-primary text-primary-foreground rounded-md"
                    size="icon"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </form>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
