import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { applyFilters, escapeLike, listKey, pageRange, toResult, type ListParams } from '@/lib/list';

type Tables = Database['public']['Tables'];
export type Company = Tables['companies']['Row'];
export type CompanyInsert = Tables['companies']['Insert'];
export type CompanyUpdate = Tables['companies']['Update'];

export type CompanyRow = Company & {
  owner: { id: string; full_name: string | null } | null;
  contacts: { count: number }[];
};

const FILTERABLE = ['status', 'owner_id', 'industry'];

export const SORTABLE_COMPANY_COLUMNS = [
  'name',
  'city',
  'industry',
  'status',
  'annual_revenue',
  'created_at',
  'updated_at',
] as const;

export function useCompanies(params: ListParams) {
  return useQuery({
    queryKey: ['companies', listKey(params)],
    placeholderData: (prev) => prev,
    queryFn: async () => {
      let query = supabase
        .from('companies')
        .select(
          '*, owner:profiles!owner_id(id, full_name), contacts(count)',
          { count: 'exact' },
        );

      const term = params.search.trim();
      if (term) {
        const safe = escapeLike(term);
        query = query.or(`name.ilike.%${safe}%,domain.ilike.%${safe}%,city.ilike.%${safe}%`);
      }

      query = applyFilters(query, params.filters, FILTERABLE);

      const sort = (SORTABLE_COMPANY_COLUMNS as readonly string[]).includes(params.sort)
        ? params.sort
        : 'created_at';
      const [from, to] = pageRange(params);

      const { data, error, count } = await query
        .order(sort, { ascending: params.asc, nullsFirst: false })
        .order('id', { ascending: true })
        .range(from, to);

      if (error) throw error;
      return toResult(data as unknown as CompanyRow[], count, params.pageSize);
    },
  });
}

export function useCompany(id: string | undefined) {
  return useQuery({
    queryKey: ['company', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('*, owner:profiles!owner_id(id, full_name)')
        .eq('id', id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as CompanyRow | null;
    },
  });
}

/** Kontakte einer Firma — für die Detailansicht. */
export function useCompanyContacts(companyId: string | undefined) {
  return useQuery({
    queryKey: ['company-contacts', companyId],
    enabled: !!companyId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('contacts')
        .select('id, full_name, job_title, email, phone, status')
        .eq('company_id', companyId!)
        .order('full_name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

function invalidateCompanies(qc: ReturnType<typeof useQueryClient>, id?: string) {
  qc.invalidateQueries({ queryKey: ['companies'] });
  if (id) qc.invalidateQueries({ queryKey: ['company', id] });
}

export function useCreateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: CompanyInsert) => {
      const { data, error } = await supabase.from('companies').insert(input).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => invalidateCompanies(qc),
  });
}

export function useUpdateCompany() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, ...patch }: CompanyUpdate & { id: string }) => {
      const { data, error } = await supabase
        .from('companies')
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => invalidateCompanies(qc, data.id),
  });
}

export function useDeleteCompanies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (ids: string[]) => {
      const { error } = await supabase.from('companies').delete().in('id', ids);
      if (error) throw error;
      return ids;
    },
    onSuccess: () => {
      invalidateCompanies(qc);
      // Kontakte verlieren beim Löschen ihre Firmenzuordnung (ON DELETE SET NULL)
      qc.invalidateQueries({ queryKey: ['contacts'] });
    },
  });
}

export function useBulkUpdateCompanies() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ ids, patch }: { ids: string[]; patch: CompanyUpdate }) => {
      const { error } = await supabase.from('companies').update(patch).in('id', ids);
      if (error) throw error;
    },
    onSuccess: () => invalidateCompanies(qc),
  });
}

export function useCompanyOptions(term: string) {
  return useQuery({
    queryKey: ['company-options', term],
    staleTime: 30_000,
    queryFn: async () => {
      let query = supabase.from('companies').select('id, name, city').limit(20);
      const t = term.trim();
      if (t) query = query.ilike('name', `%${escapeLike(t)}%`);
      const { data, error } = await query.order('name');
      if (error) throw error;
      return data ?? [];
    },
  });
}

/** Branchenliste für den Filter — aus dem Bestand, nicht fest verdrahtet. */
export function useIndustries() {
  return useQuery({
    queryKey: ['industries'],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('companies')
        .select('industry')
        .not('industry', 'is', null)
        .limit(1000);
      if (error) throw error;
      return [...new Set((data ?? []).map((r) => r.industry!).filter(Boolean))].sort();
    },
  });
}
