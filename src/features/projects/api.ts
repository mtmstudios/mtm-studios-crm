import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database, ProjectStatus } from '@/integrations/supabase/types';

type Tables = Database['public']['Tables'];
export type Project = Tables['projects']['Row'];
export type ProjectInsert = Tables['projects']['Insert'];
export type ProjectSection = Tables['project_sections']['Row'];

export type ProjectRow = Project & {
  companies: { id: string; name: string } | null;
  deals: { id: string; title: string } | null;
  owner: { id: string; full_name: string | null } | null;
};

export interface Fortschritt {
  aufgaben: number;
  erledigt: number;
  ueberfaellig: number;
}

const SELECT =
  '*, companies(id, name), deals(id, title), owner:profiles!owner_id(id, full_name)';

export const STATUS_LABEL: Record<ProjectStatus, string> = {
  planung: 'Planung',
  laeuft: 'Läuft',
  pausiert: 'Pausiert',
  abgeschlossen: 'Abgeschlossen',
  abgebrochen: 'Abgebrochen',
};

export const STATUS_TON: Record<ProjectStatus, string> = {
  planung: 'bg-slate-100 text-slate-700 hover:bg-slate-100',
  laeuft: 'bg-blue-100 text-blue-800 hover:bg-blue-100',
  pausiert: 'bg-amber-100 text-amber-800 hover:bg-amber-100',
  abgeschlossen: 'bg-emerald-100 text-emerald-800 hover:bg-emerald-100',
  abgebrochen: 'bg-zinc-100 text-zinc-500 hover:bg-zinc-100',
};

export const STATUS_OPTIONEN = (Object.keys(STATUS_LABEL) as ProjectStatus[]).map((value) => ({
  value,
  label: STATUS_LABEL[value],
}));

/* ---------------------------------------------------------------- Listen -- */

export function useProjects(opts: { status?: ProjectStatus[]; companyId?: string } = {}) {
  return useQuery({
    queryKey: ['projects', opts.status ?? null, opts.companyId ?? null],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let query = supabase.from('projects').select(SELECT);
      if (opts.status?.length) query = query.in('status', opts.status);
      if (opts.companyId) query = query.eq('company_id', opts.companyId);

      const { data, error } = await query
        // Ohne Fälligkeit ans Ende, sonst stehen ungeplante Projekte oben
        .order('due_on', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as ProjectRow[];
    },
  });
}

/** Fortschritt aller Projekte in einem Aufruf statt pro Karte. */
export function useProjectProgress(ids: string[]) {
  return useQuery({
    queryKey: ['project-progress', [...ids].sort()],
    enabled: ids.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('project_progress', { p_project_ids: ids });
      if (error) throw error;
      return new Map<string, Fortschritt>(
        (data ?? []).map((r) => [
          r.project_id,
          { aufgaben: Number(r.aufgaben), erledigt: Number(r.erledigt), ueberfaellig: Number(r.ueberfaellig) },
        ]),
      );
    },
  });
}

export function useProject(id: string | undefined) {
  return useQuery({
    queryKey: ['project', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('projects').select(SELECT).eq('id', id!).maybeSingle();
      if (error) throw error;
      return data as unknown as ProjectRow | null;
    },
  });
}

export function useProjectSections(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-sections', projectId],
    enabled: !!projectId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('project_sections')
        .select('*')
        .eq('project_id', projectId!)
        .order('position');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Aufgaben eines Projekts — dieselbe activities-Tabelle wie im übrigen CRM. */
export function useProjectTasks(projectId: string | undefined) {
  return useQuery({
    queryKey: ['project-tasks', projectId],
    enabled: !!projectId,
    placeholderData: (prev) => prev,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('activities')
        .select('*, owner:profiles!owner_id(id, full_name), companies(id, name)')
        .eq('project_id', projectId!)
        .order('position');
      if (error) throw error;
      return (data ?? []) as unknown as (Tables['activities']['Row'] & {
        owner: { id: string; full_name: string | null } | null;
        companies: { id: string; name: string } | null;
      })[];
    },
  });
}

/* --------------------------------------------------------------- Ändern -- */

function invalidate(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ['projects'] });
  qc.invalidateQueries({ queryKey: ['project-progress'] });
  if (id) {
    qc.invalidateQueries({ queryKey: ['project', id] });
    qc.invalidateQueries({ queryKey: ['project-tasks', id] });
    qc.invalidateQueries({ queryKey: ['project-sections', id] });
  }
}

export function useCreateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ProjectInsert) => {
      const { data, error } = await supabase.from('projects').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidate(qc),
  });
}

export function useUpdateProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: Tables['projects']['Update'] & { id: string }) => {
      const { data, error } = await supabase.from('projects').update(patch).eq('id', id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => invalidate(qc, data.id),
  });
}

export function useDeleteProject() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('projects').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate(qc);
      // Projektaufgaben hängen an der Kaskade und verschwinden mit
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

/** Aufgabe im Projektboard verschieben. */
export function useMoveTask(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      taskId: string;
      sectionId: string;
      beforeId?: string | null;
      afterId?: string | null;
    }) => {
      const { data, error } = await supabase.rpc('move_task', {
        p_task_id: input.taskId,
        p_section_id: input.sectionId,
        p_before_id: input.beforeId ?? null,
        p_after_id: input.afterId ?? null,
      });
      if (error) throw error;
      return data;
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: ['project-tasks', projectId] });
      qc.invalidateQueries({ queryKey: ['project-progress'] });
      qc.invalidateQueries({ queryKey: ['activities'] });
    },
  });
}

export function useCreateSection(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ name, position }: { name: string; position: number }) => {
      const { data, error } = await supabase
        .from('project_sections')
        .insert({ project_id: projectId, name, position })
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-sections', projectId] }),
  });
}

export function useRenameSection(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, name }: { id: string; name: string }) => {
      const { error } = await supabase.from('project_sections').update({ name }).eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['project-sections', projectId] }),
  });
}

export function useDeleteSection(projectId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('project_sections').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['project-sections', projectId] });
      // Aufgaben behalten ihre section_id nicht — sie landen ohne Abschnitt
      qc.invalidateQueries({ queryKey: ['project-tasks', projectId] });
    },
  });
}

/** Projekte, die an einer Firma hängen — für die Firmendetailseite. */
export function useCompanyProjects(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-projects', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, status, due_on')
        .eq('company_id', companyId!)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });
}
