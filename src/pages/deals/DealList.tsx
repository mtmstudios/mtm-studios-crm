import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Handshake, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { dateShort, money } from '@/lib/format';
import { useListParams } from '@/hooks/useListParams';
import { useDeals, useDeleteDeals, type DealRow } from '@/features/deals/api';
import { useProfiles } from '@/features/meta/api';
import { DataTable, type Column } from '@/components/data/DataTable';
import { ListToolbar } from '@/components/data/ListToolbar';
import { TablePagination } from '@/components/data/TablePagination';
import { BulkBar, DEAL_STATUS_OPTIONS, EmptyState, StatusBadge } from '@/components/crm/primitives';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/crm/ConfirmDialog';

/**
 * Tabellarische Ansicht der Deals. Wird vom Board über den Ansichtswechsel
 * eingebunden und teilt sich mit ihm die URL-Parameter nicht — die Liste
 * bringt ihre eigenen Filter mit.
 */
export default function DealList() {
  const navigate = useNavigate();
  const { params, setSearch, setPage, setPageSize, toggleSort, setFilter, clearFilters, activeFilterCount } =
    useListParams('created_at');

  const { data, isFetching } = useDeals(params);
  const { data: profiles = [] } = useProfiles();
  const remove = useDeleteDeals();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  const filters = useMemo(
    () => [
      { column: 'status', label: 'Status', options: DEAL_STATUS_OPTIONS },
      {
        column: 'owner_id',
        label: 'Inhaber',
        options: [
          { value: 'none', label: 'Nicht zugewiesen' },
          ...profiles.map((p) => ({ value: p.id, label: p.full_name ?? p.email })),
        ],
      },
    ],
    [profiles],
  );

  const columns: Column<DealRow>[] = [
    {
      key: 'title',
      header: 'Deal',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <div className="truncate font-medium">{row.title}</div>
          <div className="truncate text-xs text-muted-foreground">
            {row.companies?.name ?? row.contacts?.full_name ?? '—'}
          </div>
        </div>
      ),
    },
    {
      key: 'value',
      header: 'Wert',
      sortable: true,
      className: 'w-32 text-right',
      render: (row) => <span className="font-medium tabular-nums">{money(row.value)}</span>,
    },
    {
      key: 'stage',
      header: 'Phase',
      hideBelow: 'md',
      render: (row) => row.stages?.name ?? <span className="text-muted-foreground">—</span>,
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      className: 'w-28',
      render: (row) => <StatusBadge kind="deal" value={row.status} />,
    },
    {
      key: 'expected_close_date',
      header: 'Abschluss',
      sortable: true,
      hideBelow: 'lg',
      className: 'w-28',
      render: (row) => (
        <span className="text-muted-foreground">{dateShort(row.expected_close_date)}</span>
      ),
    },
    {
      key: 'owner',
      header: 'Inhaber',
      hideBelow: 'xl',
      render: (row) => (
        <span className="truncate text-muted-foreground">{row.owner?.full_name ?? '—'}</span>
      ),
    },
  ];

  const doDelete = async () => {
    const ids = [...selected];
    await remove.mutateAsync(ids);
    toast.success(`${ids.length} Deals gelöscht`);
    setSelected(new Set());
    setConfirmDelete(false);
  };

  return (
    <>
      <div className="px-4 pb-3 sm:px-6">
        <ListToolbar
          search={params.search}
          onSearchChange={setSearch}
          placeholder="Deal-Titel …"
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
          onRowClick={(row) => navigate(`/deals/${row.id}`)}
          selected={selected}
          onSelectedChange={setSelected}
          empty={
            <EmptyState
              icon={Handshake}
              title={params.search || activeFilterCount ? 'Keine Treffer' : 'Noch keine Deals'}
              description="Deals entstehen im Board oder über die Schaltfläche „Deal“."
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

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`${selected.size} ${selected.size === 1 ? 'Deal' : 'Deals'} löschen?`}
        description="Zugehörige Aufgaben und Notizen werden mitgelöscht."
        confirmLabel="Löschen"
        destructive
        onConfirm={doDelete}
      />
    </>
  );
}
