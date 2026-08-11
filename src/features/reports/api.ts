import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardMetrics } from '@/integrations/supabase/types';

export type Range = '7t' | '30t' | '90t' | 'jahr';

export const RANGE_LABEL: Record<Range, string> = {
  '7t': 'Letzte 7 Tage',
  '30t': 'Letzte 30 Tage',
  '90t': 'Letzte 90 Tage',
  jahr: 'Laufendes Jahr',
};

/** Zeitraum in absolute Grenzen übersetzen. */
export function rangeBounds(range: Range): { from: Date; to: Date } {
  const to = new Date();
  const from = new Date();
  if (range === 'jahr') {
    from.setMonth(0, 1);
    from.setHours(0, 0, 0, 0);
  } else {
    const days = { '7t': 7, '30t': 30, '90t': 90 }[range];
    from.setDate(from.getDate() - days);
  }
  return { from, to };
}

export function useDashboardMetrics(range: Range, ownerId?: string | null) {
  const { from, to } = rangeBounds(range);
  return useQuery({
    queryKey: ['metrics', range, ownerId ?? null],
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('dashboard_metrics', {
        p_from: from.toISOString(),
        p_to: to.toISOString(),
        p_owner_id: ownerId ?? null,
      });
      if (error) throw error;
      return data as unknown as DashboardMetrics;
    },
  });
}

export function usePipelineConversion(pipelineId: string | undefined) {
  return useQuery({
    queryKey: ['conversion', pipelineId],
    enabled: !!pipelineId,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('pipeline_conversion', {
        p_pipeline_id: pipelineId!,
      });
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Zuletzt gewonnene Deals — kleine Erfolgsliste auf dem Dashboard. */
export function useRecentWins(limit = 5) {
  return useQuery({
    queryKey: ['recent-wins', limit],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('deals')
        .select('id, title, value, won_at, companies(name)')
        .eq('status', 'won')
        .not('won_at', 'is', null)
        .order('won_at', { ascending: false })
        .limit(limit);
      if (error) throw error;
      return (data ?? []) as unknown as {
        id: string;
        title: string;
        value: number;
        won_at: string;
        companies: { name: string } | null;
      }[];
    },
  });
}
