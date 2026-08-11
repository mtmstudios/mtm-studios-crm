import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { escapeLike } from '@/lib/list';

type Tables = Database['public']['Tables'];
export type Conversation = Tables['conversations']['Row'];
export type Message = Tables['messages']['Row'];

export type ConversationRow = Conversation & {
  contacts: { id: string; full_name: string } | null;
  companies: { id: string; name: string } | null;
};

export function useConversations(search: string, archived = false) {
  return useQuery({
    queryKey: ['conversations', search, archived],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let query = supabase
        .from('conversations')
        .select('*, contacts(id, full_name), companies(id, name)')
        .eq('is_archived', archived);

      const term = search.trim();
      if (term) {
        const safe = escapeLike(term);
        query = query.or(`counterparty.ilike.%${safe}%,subject.ilike.%${safe}%`);
      }

      const { data, error } = await query.order('last_message_at', { ascending: false }).limit(100);
      if (error) throw error;
      return (data ?? []) as unknown as ConversationRow[];
    },
  });
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    queryKey: ['messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('messages')
        .select('*')
        .eq('conversation_id', conversationId!)
        .order('sent_at', { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/**
 * Gelesen-Markierung. Läuft bewusst ohne Optimistik: der Zähler ist
 * unkritisch und ein Rücksprung wäre irritierender als die Verzögerung.
 */
export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (conversationId: string) => {
      const { error } = await supabase
        .from('conversations')
        .update({ unread_count: 0 })
        .eq('id', conversationId)
        .gt('unread_count', 0);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

export function useArchiveConversation() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, archived }: { id: string; archived: boolean }) => {
      const { error } = await supabase
        .from('conversations')
        .update({ is_archived: archived })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['conversations'] }),
  });
}

/**
 * Ausgehende Nachricht festhalten. Der eigentliche Versand hängt am
 * jeweiligen Anbieter (E-Mail, SMS, WhatsApp) und läuft über eine Edge
 * Function — hier wird nur der Verlauf im CRM geschrieben.
 */
export function useSendMessage() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      conversationId: string;
      body: string;
      toAddr: string;
      createdBy: string | null;
    }) => {
      const { data, error } = await supabase
        .from('messages')
        .insert({
          conversation_id: input.conversationId,
          direction: 'outbound',
          body: input.body,
          to_addr: input.toAddr,
          created_by: input.createdBy,
          sent_at: new Date().toISOString(),
        })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ['messages', data.conversation_id] });
      qc.invalidateQueries({ queryKey: ['conversations'] });
    },
  });
}
