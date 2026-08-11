import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { applyFilters, escapeLike, listKey, pageRange, toResult, type ListParams } from '@/lib/list';

type Tables = Database['public']['Tables'];
export type Contact = Tables['contacts']['Row'];
export type ContactInsert = Tables['contacts']['Insert'];
export type ContactUpdate = Tables['contacts']['Update'];

export type ContactRow = Contact & {
  companies: { id: string; name: string } | null;
  owner: { id: string; full_name: string | null } | null;
};

const FILTERABLE = ['status', 'owner_id', 'company_id'];

export const SORTABLE_CONTACT_COLUMNS = [
  'full_name',
  'email',
  'phone',
  'status',
  'created_at',
  'updated_at',
] as const;

export function useContacts(params: ListParams) {
  return useQuery({
    queryKey: ['contacts', listKey(params)],
    // Beim Blättern und Filtern die vorherige Seite stehen lassen, statt die
    // Tabelle kurz durch einen Skeleton zu ersetzen.
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let query = supabase
        .from('contacts')
        .select('*, companies(id, name), owner:profiles!contacts_owner_id_fkey(id, full_name)', {
          count: 'exact',
        });

      const term = params.search.trim();
      if (term) {
        const safe = escapeLike(term);
        query = query.or(
          `full_name.ilike.%${safe}%,email.ilike.%${safe}%,phone.ilike.%${safe}%,mobile.ilike.%${safe}%`,
        );
      }

      query = applyFilters(query, params.filters, FILTERABLE);

      const sort = (SORTABLE_CONTACT_COLUMNS as readonly string[]).includes(params.sort)
        ? params.sort
        : 'created_at';
      const [from, to] = pageRange(params);

      const { data, error, count } = await query
        .order(sort, { ascending: params.asc, nullsFirst: false })
        // Zweites Sortierkriterium, damit die Reihenfolge bei gleichen Werten
        // über Seitengrenzen hinweg stabil bleibt.
        .order('id', { ascending: true })
        .range(from, to);

      if (error) throw error;
      return toResult(data as unknown as ContactRow[], count, params.pageSize);
    },
  });
}

export function useContact(id: string | undefined) {
  return useQuery({
    queryKey: ['contact', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('*, companies(id, name, domain, city), owner:profiles!contacts_owner_id_fkey(id, full_name)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as (ContactRow & { companies: { id: string; name: string; domain: string | null; city: string | null } | null }) | null;
    },
  });
}

/** Alle Listen und die Detailansicht nach einer Änderung neu laden. */
function invalidateContacts(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ['contacts'] });
  if (id) qc.invalidateQueries({ queryKey: ['contact', id] });
}

export function useCreateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ContactInsert) => {
      const { data, error } = await supabase.from('contacts').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateContacts(qc),
  });
}

export function useUpdateContact() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: ContactUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('contacts')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => invalidateContacts(qc, data.id),
  });
}

export function useDeleteContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('contacts').delete().in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: () => invalidateContacts(qc),
  });
}

/** Sammelbearbeitung aus der Listenansicht (Inhaber, Status). */
export function useBulkUpdateContacts() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: ContactUpdate }) => {
      const { error } = await supabase.from('contacts').update(patch).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => invalidateContacts(qc),
  });
}

/** Typeahead für Verknüpfungsfelder (Deal → Kontakt usw.). */
export function useContactOptions(term: string) {
  return useQuery({
    queryKey: ['contact-options', term],
    staleTime: 30_000,
    queryFn: async () => {
      let query = supabase.from('contacts').select('id, full_name, email, company_id').limit(20);
      const t = term.trim();
      if (t) {
        const safe = escapeLike(t);
        query = query.or(`full_name.ilike.%${safe}%,email.ilike.%${safe}%`);
      }
      const { data, error } = await query.order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });
}
