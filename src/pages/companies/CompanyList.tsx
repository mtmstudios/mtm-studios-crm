import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Building2, Globe, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { dateShort, num, toDomain } from '@/lib/format';
import { useListParams } from '@/hooks/useListParams';
import {
  useBulkUpdateCompanies,
  useCompanies,
  useDeleteCompanies,
  useIndustries,
  type CompanyRow,
} from '@/features/companies/api';
import { useProfiles } from '@/features/meta/api';
import { DataTable, type Column } from '@/components/data/DataTable';
import { ListToolbar } from '@/components/data/ListToolbar';
import { TablePagination } from '@/components/data/TablePagination';
import {
  BulkBar,
  COMPANY_STATUS_OPTIONS,
  EmptyState,
  EntityAvatar,
  PageHeader,
  StatusBadge,
} from '@/components/crm/primitives';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ConfirmDialog } from '@/components/crm/ConfirmDialog';
import { CompanyDialog } from './CompanyDialog';
import type { CompanyStatus } from '@/integrations/supabase/types';

export default function CompanyList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { params, setSearch, setPage, setPageSize, toggleSort, setFilter, clearFilters, activeFilterCount } =
    useListParams('created_at');

  const { data, isFetching } = useCompanies(params);
  const { data: profiles = [] } = useProfiles();
  const { data: industries = [] } = useIndustries();
  const bulkUpdate = useBulkUpdateCompanies();
  const remove = useDeleteCompanies();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const createOpen = searchParams.get('neu') === '1';
  const setCreateOpen = (open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set('neu', '1');
    else next.delete('neu');
    setSearchParams(next, { replace: true });
  };

  const filters = useMemo(
    () => [
      { column: 'status', label: 'Status', options: COMPANY_STATUS_OPTIONS },
      {
        column: 'owner_id',
        label: 'Inhaber',
        options: [
          { value: 'none', label: 'Nicht zugewiesen' },
          ...profiles.map((p) => ({ value: p.id, label: p.full_name ?? p.email })),
        ],
      },
      ...(industries.length
        ? [
            {
              column: 'industry',
              label: 'Branche',
              options: industries.map((i) => ({ value: i, label: i })),
            },
          ]
        : []),
    ],
    [profiles, industries],
  );

  const columns: Column<CompanyRow>[] = [
    {
      key: 'name',
      header: 'Firma',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <EntityAvatar name={row.name} seed={row.id} size="sm" square />
          <div className="min-w-0">
            <div className="truncate font-medium">{row.name}</div>
            {row.industry && <div className="truncate text-xs text-muted-foreground">{row.industry}</div>}
          </div>
        </div>
      ),
    },
    {
      key: 'city',
      header: 'Ort',
      sortable: true,
      hideBelow: 'md',
      render: (row) => row.city ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'website',
      header: 'Website',
      hideBelow: 'lg',
      render: (row) => {
        const domain = toDomain(row.website ?? row.domain);
        return domain ? (
          <a
            href={row.website ?? `https://${domain}`}
            target="_blank"
            rel="noreferrer noopener"
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 truncate hover:text-primary hover:underline"
          >
            <Globe className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{domain}</span>
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      key: 'contacts',
      header: 'Kontakte',
      hideBelow: 'xl',
      className: 'w-24',
      render: (row) => (
        <span className="text-muted-foreground">{num(row.contacts?.[0]?.count ?? 0)}</span>
      ),
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      className: 'w-32',
      render: (row) => <StatusBadge kind="company" value={row.status} />,
    },
    {
      key: 'owner',
      header: 'Inhaber',
      hideBelow: 'xl',
      render: (row) => (
        <span className="truncate text-muted-foreground">{row.owner?.full_name ?? '—'}</span>
      ),
    },
    {
      key: 'created_at',
      header: 'Angelegt',
      sortable: true,
      hideBelow: 'lg',
      className: 'w-28',
      render: (row) => <span className="text-muted-foreground">{dateShort(row.created_at)}</span>,
    },
  ];

  const setStatus = async (status: CompanyStatus) => {
    const ids = [...selected];
    await bulkUpdate.mutateAsync({ ids, patch: { status } });
    toast.success(`${ids.length} Firmen aktualisiert`);
    setSelected(new Set());
  };

  const doDelete = async () => {
    const ids = [...selected];
    await remove.mutateAsync(ids);
    toast.success(`${ids.length} Firmen gelöscht`);
    setSelected(new Set());
    setConfirmDelete(false);
  };

  return (
    <>
      <PageHeader title="Firmen" subtitle={data ? `${data.total} Einträge` : undefined}>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Firma
        </Button>
      </PageHeader>

      <div className="px-4 py-3 sm:px-6">
        <ListToolbar
          search={params.search}
          onSearchChange={setSearch}
          placeholder="Name, Domain oder Ort …"
          filters={filters}
          active={params.filters}
          onFilterChange={setFilter}
          onClear={clearFilters}
          activeCount={activeFilterCount}
        />
      </div>

      <div className="border-y border-border">
        <DataTable
          rows={data?.rows ?? []}
          columns={columns}
          rowId={(row) => row.id}
          loading={isFetching}
          sort={params.sort}
          asc={params.asc}
          onSort={toggleSort}
          onRowClick={(row) => navigate(`/firmen/${row.id}`)}
          selected={selected}
          onSelectedChange={setSelected}
          empty={
            <EmptyState
              icon={Building2}
              title={params.search || activeFilterCount ? 'Keine Treffer' : 'Noch keine Firmen'}
              description={
                params.search || activeFilterCount
                  ? 'Andere Suchbegriffe oder Filter probieren.'
                  : 'Lege die erste Firma an oder importiere den Bestand aus sevDesk.'
              }
              action={
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Firma anlegen
                </Button>
              }
            />
          }
        />
        {data && data.total > 0 && (
          <TablePagination
            page={params.page}
            pageSize={params.pageSize}
            pageCount={data.pageCount}
            total={data.total}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        )}
      </div>

      <BulkBar count={selected.size} onClear={() => setSelected(new Set())}>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8">
              Status setzen
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {COMPANY_STATUS_OPTIONS.map((o) => (
              <DropdownMenuItem key={o.value} onSelect={() => void setStatus(o.value as CompanyStatus)}>
                {o.label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>

        <Button
          variant="outline"
          size="sm"
          className="h-8 text-destructive hover:text-destructive"
          onClick={() => setConfirmDelete(true)}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" />
          Löschen
        </Button>
      </BulkBar>

      <CompanyDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`${selected.size} ${selected.size === 1 ? 'Firma' : 'Firmen'} löschen?`}
        description="Kontakte bleiben erhalten, verlieren aber ihre Firmenzuordnung."
        confirmLabel="Löschen"
        destructive
        onConfirm={doDelete}
      />
    </>
  );
}
