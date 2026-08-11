import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { applyFilters, escapeLike, listKey, pageRange, toResult, type ListParams } from '@/lib/list';

type Tables = Database['public']['Tables'];
export type Activity = Tables['activities']['Row'];
export type ActivityInsert = Tables['activities']['Insert'];
export type ActivityUpdate = Tables['activities']['Update'];
export type Note = Tables['notes']['Row'];

export type ActivityRow = Activity & {
  contacts: { id: string; full_name: string } | null;
  companies: { id: string; name: string } | null;
  deals: { id: string; title: string } | null;
  owner: { id: string; full_name: string | null } | null;
};

const SELECT =
  '*, contacts(id, full_name), companies(id, name), deals(id, title), ' +
  'owner:profiles!activities_owner_id_fkey(id, full_name)';

const FILTERABLE = ['type', 'owner_id', 'done'];

export const SORTABLE_ACTIVITY_COLUMNS = ['due_at', 'subject', 'type', 'created_at'] as const;

export function useActivities(params: ListParams) {
  return useQuery({
    queryKey: ['activities', listKey(params)],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let query = supabase.from('activities').select(SELECT, { count: 'exact' });

      const term = params.search.trim();
      if (term) {
        const safe = escapeLike(term);
        query = query.or(`subject.ilike.%${safe}%,notes.ilike.%${safe}%`);
      }

      // „done" kommt als Text aus der URL und muss zurück auf boolean
      const { done, ...rest } = params.filters;
      query = applyFilters(query, rest, FILTERABLE.filter((f) => f !== 'done'));
      if (done?.length === 1) query = query.eq('done', done[0] === 'true');

      // Sonderfall Überfällig: offen und Fälligkeit in der Vergangenheit
      if (params.filters.overdue?.[0] === 'true') {
        query = query.eq('done', false).lt('due_at', new Date().toISOString());
      }

      const sort = (SORTABLE_ACTIVITY_COLUMNS as readonly string[]).includes(params.sort)
        ? params.sort
        : 'due_at';
      const [from, to] = pageRange(params);

      const { data, error, count } = await query
        .order(sort, { ascending: params.asc, nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, to);

      if (error) throw error;
      return toResult(data as unknown as ActivityRow[], count, params.pageSize);
    },
  });
}

/** Offene Aufgaben des angemeldeten Nutzers — für Dashboard und Seitenleiste. */
export function useMyOpenActivities(ownerId: string | undefined, limit = 8) {
  return useQuery({
    queryKey: ['my-activities', ownerId, limit],
    enabled: !!ownerId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select(SELECT)
        .eq('owner_id', ownerId!)
        .eq('done', false)
        .not('due_at', 'is', null)
        .order('due_at', { ascending: true })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as ActivityRow[];
    },
  });
}

function invalidateActivities(qc: ReturnType<typeof useQueryClient>) {
  qc.invalidateQueries({ queryKey: ['activities'] });
  qc.invalidateQueries({ queryKey: ['my-activities'] });
  qc.invalidateQueries({ queryKey: ['timeline'] });
  qc.invalidateQueries({ queryKey: ['metrics'] });
}

export function useCreateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ActivityInsert) => {
      const { data, error } = await supabase.from('activities').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateActivities(qc),
  });
}

export function useUpdateActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: ActivityUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('activities')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateActivities(qc),
  });
}

/** Erledigt-Haken. Setzt done_at mit, damit die Auswertung stimmt. */
export function useToggleActivity() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, done }: { id: string; done: boolean }) => {
      const { data, error } = await supabase
        .from('activities')
        .update({ done, done_at: done ? new Date().toISOString() : null })
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateActivities(qc),
  });
}

export function useDeleteActivities() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('activities').delete().in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: () => invalidateActivities(qc),
  });
}

/* ---------------------------------------------------------------- Notizen -- */

export function useCreateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { body: string; deal_id?: string; contact_id?: string; company_id?: string }) => {
      const { data, error } = await supabase.from('notes').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeline'] }),
  });
}

export function useUpdateNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase.from('notes').update({ body }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeline'] }),
  });
}

export function useDeleteNote() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('notes').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['timeline'] }),
  });
}

/* --------------------------------------------------------------- Zeitleiste -- */

export type TimelineItem =
  | { kind: 'note'; at: string; note: Note & { author: { full_name: string | null } | null } }
  | { kind: 'activity'; at: string; activity: ActivityRow };

/**
 * Notizen und Aktivitäten eines Datensatzes zu einem Strang zusammenführen.
 * Beide Quellen einzeln zu laden ist hier günstiger als eine Datenbank-Sicht:
 * die Mengen sind klein und die Sortierung ist trivial.
 */
export function useTimeline(key: 'deal_id' | 'contact_id' | 'company_id', value: string | undefined) {
  return useQuery({
    queryKey: ['timeline', key, value],
    enabled: !!value,
    queryFn: async (): Promise<TimelineItem[]> => {
      const [notes, activities] = await Promise.all([
        supabase
          .from('notes')
          .select('*, author:profiles!notes_created_by_fkey(full_name)')
          .eq(key, value!)
          .order('created_at', { ascending: false })
          .limit(100),
        supabase
          .from('activities')
          .select(SELECT)
          .eq(key, value!)
          .order('created_at', { ascending: false })
          .limit(100),
      ]);

      if (notes.error) throw notes.error;
      if (activities.error) throw activities.error;

      const items: TimelineItem[] = [
        ...(notes.data ?? []).map((n) => ({
          kind: 'note' as const,
          at: n.created_at,
          note: n as unknown as Note & { author: { full_name: string | null } | null },
        })),
        ...(activities.data ?? []).map((a) => ({
          kind: 'activity' as const,
          // Aktivitäten hängen an ihrer Fälligkeit, sofern gesetzt — das ist
          // der Zeitpunkt, den der Nutzer erwartet.
          at: (a as unknown as ActivityRow).due_at ?? (a as unknown as ActivityRow).created_at,
          activity: a as unknown as ActivityRow,
        })),
      ];

      return items.sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime());
    },
  });
}
