import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database, EntityType } from '@/integrations/supabase/types';

type Tables = Database['public']['Tables'];
export type Profile = Tables['profiles']['Row'];
export type Pipeline = Tables['pipelines']['Row'];
export type Stage = Tables['stages']['Row'];
export type Tag = Tables['tags']['Row'];
export type LostReason = Tables['lost_reasons']['Row'];
export type CustomFieldDef = Tables['custom_field_defs']['Row'];

/**
 * Stammdaten ändern sich selten und werden auf fast jeder Seite gebraucht.
 * Eine großzügige staleTime spart einen Schwung Roundtrips pro Navigation.
 */
const STATIC = { staleTime: 5 * 60_000 };

export function useProfiles() {
  return useQuery({
    ...STATIC,
    queryKey: ['profiles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('is_active', true)
        .order('full_name');
      if (error) throw error;
      return data;
    },
  });
}

export function usePipelines() {
  return useQuery({
    ...STATIC,
    queryKey: ['pipelines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pipelines')
        .select('*, stages(*)')
        .order('position')
        .order('position', { referencedTable: 'stages' });
      if (error) throw error;
      // Eingebettete Relationen kann der handgeschriebene Database-Typ nicht
      // ableiten (leere Relationships) — daher hier explizit.
      return (data ?? []) as unknown as (Pipeline & { stages: Stage[] })[];
    },
  });
}

export function useStages(pipelineId: string | undefined) {
  return useQuery({
    ...STATIC,
    queryKey: ['stages', pipelineId],
    enabled: !!pipelineId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stages')
        .select('*')
        .eq('pipeline_id', pipelineId!)
        .order('position');
      if (error) throw error;
      return data;
    },
  });
}

export function useLostReasons() {
  return useQuery({
    ...STATIC,
    queryKey: ['lost_reasons'],
    queryFn: async () => {
      const { data, error } = await supabase.from('lost_reasons').select('*').order('position');
      if (error) throw error;
      return data;
    },
  });
}

export function useTags() {
  return useQuery({
    ...STATIC,
    queryKey: ['tags'],
    queryFn: async () => {
      const { data, error } = await supabase.from('tags').select('*').order('label');
      if (error) throw error;
      return data;
    },
  });
}

export function useCustomFields(entity: EntityType) {
  return useQuery({
    ...STATIC,
    queryKey: ['custom_field_defs', entity],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_field_defs')
        .select('*')
        .eq('entity', entity)
        .order('position');
      if (error) throw error;
      return data;
    },
  });
}

/** Tags einer Entität — polymorph über die taggings-Tabelle. */
export function useEntityTags(entity: EntityType, entityId: string | undefined) {
  return useQuery({
    queryKey: ['taggings', entity, entityId],
    enabled: !!entityId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('taggings')
        .select('tag_id, tags(*)')
        .eq('entity', entity)
        .eq('entity_id', entityId!);
      if (error) throw error;
      return (data ?? []).map((t) => (t as unknown as { tags: Tag }).tags).filter(Boolean);
    },
  });
}

export function useSetEntityTags(entity: EntityType, entityId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (tagIds: string[]) => {
      // Vollständig ersetzen: erst löschen, dann setzen. Bei der Größenordnung
      // (wenige Tags pro Datensatz) ist ein Diff den Aufwand nicht wert.
      const { error: delError } = await supabase
        .from('taggings')
        .delete()
        .eq('entity', entity)
        .eq('entity_id', entityId);
      if (delError) throw delError;

      if (!tagIds.length) return;
      const { error } = await supabase
        .from('taggings')
        .insert(tagIds.map((tag_id) => ({ tag_id, entity, entity_id: entityId })));
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['taggings', entity, entityId] }),
  });
}

export function useCreateTag() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { label: string; color?: string }) => {
      const { data, error } = await supabase.from('tags').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['tags'] }),
  });
}

/** Globale Suche für die Befehlspalette. */
export function useGlobalSearch(term: string) {
  return useQuery({
    queryKey: ['search', term],
    enabled: term.trim().length >= 2,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('search_global', { q: term.trim() });
      if (error) throw error;
      return data ?? [];
    },
  });
}
