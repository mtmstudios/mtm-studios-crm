import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { applyFilters, escapeLike, listKey, pageRange, toResult, type ListParams } from '@/lib/list';

type Tables = Database['public']['Tables'];
export type Deal = Tables['deals']['Row'];
export type DealInsert = Tables['deals']['Insert'];
export type DealUpdate = Tables['deals']['Update'];

export type DealRow = Deal & {
  contacts: { id: string; full_name: string } | null;
  companies: { id: string; name: string } | null;
  owner: { id: string; full_name: string | null } | null;
  stages: { id: string; name: string; probability: number; rotting_days: number | null } | null;
};

/** Karten pro Spalte. Darüber hinaus wird nachgeladen. */
export const BOARD_PAGE = 50;

const FILTERABLE = ['status', 'owner_id', 'stage_id', 'pipeline_id'];

export const SORTABLE_DEAL_COLUMNS = [
  'title',
  'value',
  'expected_close_date',
  'status',
  'created_at',
  'updated_at',
  'stage_changed_at',
] as const;

const SELECT =
  '*, contacts(id, full_name), companies(id, name), ' +
  'owner:profiles!owner_id(id, full_name), ' +
  'stages(id, name, probability, rotting_days)';

/* ---------------------------------------------------------------- Listen -- */

export function useDeals(params: ListParams) {
  return useQuery({
    queryKey: ['deals', listKey(params)],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let query = supabase.from('deals').select(SELECT, { count: 'exact' });

      const term = params.search.trim();
      if (term) query = query.ilike('title', `%${escapeLike(term)}%`);

      query = applyFilters(query, params.filters, FILTERABLE);

      const sort = (SORTABLE_DEAL_COLUMNS as readonly string[]).includes(params.sort)
        ? params.sort
        : 'created_at';
      const [from, to] = pageRange(params);

      const { data, error, count } = await query
        .order(sort, { ascending: params.asc, nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, to);

      if (error) throw error;
      return toResult(data as unknown as DealRow[], count, params.pageSize);
    },
  });
}

/* ----------------------------------------------------------------- Board -- */

export interface BoardFilter {
  pipelineId: string;
  ownerId?: string | null;
  search?: string;
}

/** Karten des Boards — offene Deals der Pipeline, nach Stage und Position. */
export function useBoardDeals({ pipelineId, ownerId, search }: BoardFilter) {
  return useQuery({
    queryKey: ['board', pipelineId, ownerId ?? null, search ?? ''],
    enabled: !!pipelineId,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let query = supabase
        .from('deals')
        .select(SELECT)
        .eq('pipeline_id', pipelineId)
        .eq('status', 'open');

      if (ownerId) query = query.eq('owner_id', ownerId);
      if (search?.trim()) query = query.ilike('title', `%${escapeLike(search.trim())}%`);

      const { data, error } = await query
        .order('stage_id')
        .order('position', { ascending: true })
        .limit(BOARD_PAGE * 12);

      if (error) throw error;
      return (data ?? []) as unknown as DealRow[];
    },
  });
}

/** Anzahl und Summe je Spalte — serverseitig, unabhängig von den geladenen Karten. */
export function useBoardSummary({ pipelineId, ownerId }: BoardFilter) {
  return useQuery({
    queryKey: ['board-summary', pipelineId, ownerId ?? null],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('board_summary', {
        p_pipeline_id: pipelineId,
        p_owner_id: ownerId ?? null,
      });
      if (error) throw error;
      return new Map((data ?? []).map((r) => [r.stage_id, r]));
    },
  });
}

/* ------------------------------------------------------------ Einzelnes -- */

export function useDeal(id: string | undefined) {
  return useQuery({
    queryKey: ['deal', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select(`${SELECT}, lost_reasons(id, label)`)
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as (DealRow & { lost_reasons: { id: string; label: string } | null }) | null;
    },
  });
}

/** Stage-Verlauf eines Deals für die Zeitleiste. */
export function useDealStageHistory(dealId: string | undefined) {
  return useQuery({
    queryKey: ['deal-history', dealId],
    enabled: !!dealId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deal_stage_history')
        .select('*, to_stage:stages!to_stage_id(name)')
        .eq('deal_id', dealId!)
        .order('changed_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (Tables['deal_stage_history']['Row'] & {
        to_stage: { name: string } | null;
      })[];
    },
  });
}

/* --------------------------------------------------------------- Ändern -- */

function invalidateDeals(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ['deals'] });
  qc.invalidateQueries({ queryKey: ['board'] });
  qc.invalidateQueries({ queryKey: ['board-summary'] });
  qc.invalidateQueries({ queryKey: ['metrics'] });
  if (id) {
    qc.invalidateQueries({ queryKey: ['deal', id] });
    qc.invalidateQueries({ queryKey: ['deal-history', id] });
  }
}

export function useCreateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DealInsert) => {
      const { data, error } = await supabase.from('deals').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateDeals(qc),
  });
}

export function useUpdateDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: DealUpdate & { id: string }) => {
      const { data, error } = await supabase.from('deals').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => invalidateDeals(qc, data.id),
  });
}

export function useDeleteDeals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('deals').delete().in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: () => invalidateDeals(qc),
  });
}

/**
 * Karte im Board verschieben. Die Position vergibt die Datenbank aus den
 * Nachbarkarten; hier wird nur optimistisch die Anzeige vorweggenommen,
 * damit die Karte nicht sichtbar zurückspringt.
 */
export function useMoveDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      dealId: string;
      stageId: string;
      beforeId?: string | null;
      afterId?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('move_deal', {
        p_deal_id: input.dealId,
        p_stage_id: input.stageId,
        p_before_id: input.beforeId ?? null,
        p_after_id: input.afterId ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSettled: () => invalidateDeals(qc),
  });
}

export function useWinDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dealId: string) => {
      const { data, error } = await supabase.rpc('win_deal', { p_deal_id: dealId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => invalidateDeals(qc, (data as Deal | null)?.id),
  });
}

export function useLoseDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { dealId: string; reasonId?: string | null; comment?: string | null }) => {
      const { data, error } = await supabase.rpc('lose_deal', {
        p_deal_id: input.dealId,
        p_reason_id: input.reasonId ?? null,
        p_comment: input.comment ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => invalidateDeals(qc, (data as Deal | null)?.id),
  });
}

export function useReopenDeal() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (dealId: string) => {
      const { data, error } = await supabase.rpc('reopen_deal', { p_deal_id: dealId });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => invalidateDeals(qc, (data as Deal | null)?.id),
  });
}

export function useBulkUpdateDeals() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: DealUpdate }) => {
      const { error } = await supabase.from('deals').update(patch).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => invalidateDeals(qc),
  });
}

/** Deals, die an einem Kontakt oder einer Firma hängen. */
export function useRelatedDeals(key: 'contact_id' | 'company_id', value: string | undefined) {
  return useQuery({
    queryKey: ['related-deals', key, value],
    enabled: !!value,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('id, title, value, status, stage_id, expected_close_date, stages(name)')
        .eq(key, value!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as (Pick<
        Deal,
        'id' | 'title' | 'value' | 'status' | 'stage_id' | 'expected_close_date'
      > & { stages: { name: string } | null })[];
    },
  });
}

/**
 * Ein Deal gilt als „liegengeblieben", wenn er länger in seiner Stage steht,
 * als dort hinterlegt ist. Entspricht dem „rotting" aus Pipedrive.
 */
export function isRotting(deal: DealRow): boolean {
  const days = deal.stages?.rotting_days;
  if (!days || deal.status !== 'open') return false;
  const since = (Date.now() - new Date(deal.stage_changed_at).getTime()) / 86_400_000;
  return since > days;
}
