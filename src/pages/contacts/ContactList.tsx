import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Mail, Phone, Plus, Trash2, Users } from 'lucide-react';
import { toast } from 'sonner';
import { dateShort, displayName } from '@/lib/format';
import { useListParams } from '@/hooks/useListParams';
import {
  useBulkUpdateContacts,
  useContacts,
  useDeleteContacts,
  type ContactRow,
} from '@/features/contacts/api';
import { useProfiles } from '@/features/meta/api';
import { DataTable, type Column } from '@/components/data/DataTable';
import { ListToolbar } from '@/components/data/ListToolbar';
import { TablePagination } from '@/components/data/TablePagination';
import {
  BulkBar,
  CONTACT_STATUS_OPTIONS,
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
import { ContactDialog } from './ContactDialog';
import { ConfirmDialog } from '@/components/crm/ConfirmDialog';

export default function ContactList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { params, setSearch, setPage, setPageSize, toggleSort, setFilter, clearFilters, activeFilterCount } =
    useListParams('created_at');

  const { data, isFetching, error, refetch } = useContacts(params);
  const { data: profiles = [] } = useProfiles();
  const bulkUpdate = useBulkUpdateContacts();
  const remove = useDeleteContacts();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);

  // ?neu=1 öffnet das Anlegen-Formular (Befehlspalette, Direktlink)
  const createOpen = searchParams.get('neu') === '1';
  const setCreateOpen = (open: boolean) => {
    const next = new URLSearchParams(searchParams);
    if (open) next.set('neu', '1');
    else next.delete('neu');
    setSearchParams(next, { replace: true });
  };

  const filters = useMemo(
    () => [
      { column: 'status', label: 'Status', options: CONTACT_STATUS_OPTIONS },
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

  const columns: Column<ContactRow>[] = [
    {
      key: 'full_name',
      header: 'Name',
      sortable: true,
      render: (row) => (
        <div className="flex items-center gap-2.5">
          <EntityAvatar name={displayName(row)} seed={row.id} size="sm" />
          <div className="min-w-0">
            <div className="truncate font-medium">{displayName(row)}</div>
            {row.job_title && (
              <div className="truncate text-xs text-muted-foreground">{row.job_title}</div>
            )}
          </div>
        </div>
      ),
    },
    {
      key: 'company',
      header: 'Firma',
      hideBelow: 'md',
      render: (row) =>
        row.companies ? (
          <button
            className="truncate text-left hover:text-primary hover:underline"
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/firmen/${row.companies!.id}`);
            }}
          >
            {row.companies.name}
          </button>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'email',
      header: 'E-Mail',
      sortable: true,
      hideBelow: 'lg',
      render: (row) =>
        row.email ? (
          <a
            href={`mailto:${row.email}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 truncate hover:text-primary hover:underline"
          >
            <Mail className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="truncate">{row.email}</span>
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        ),
    },
    {
      key: 'phone',
      header: 'Telefon',
      hideBelow: 'xl',
      render: (row) => {
        const number = row.phone ?? row.mobile;
        return number ? (
          <a
            href={`tel:${number}`}
            onClick={(e) => e.stopPropagation()}
            className="inline-flex items-center gap-1.5 hover:text-primary hover:underline"
          >
            <Phone className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            {number}
          </a>
        ) : (
          <span className="text-muted-foreground">—</span>
        );
      },
    },
    {
      key: 'status',
      header: 'Status',
      sortable: true,
      className: 'w-28',
      render: (row) => <StatusBadge kind="contact" value={row.status} />,
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

  const assignOwner = async (ownerId: string | null) => {
    const ids = [...selected];
    await bulkUpdate.mutateAsync({ ids, patch: { owner_id: ownerId } });
    toast.success(`${ids.length} Kontakte aktualisiert`);
    setSelected(new Set());
  };

  const doDelete = async () => {
    const ids = [...selected];
    await remove.mutateAsync(ids);
    toast.success(`${ids.length} Kontakte gelöscht`);
    setSelected(new Set());
    setConfirmDelete(false);
  };

  return (
    <>
      <PageHeader title="Kontakte" subtitle={data ? `${data.total} Einträge` : undefined}>
        <Button size="sm" onClick={() => setCreateOpen(true)}>
          <Plus className="mr-1.5 h-4 w-4" />
          Kontakt
        </Button>
      </PageHeader>

      <div className="px-4 py-3 sm:px-6">
        <ListToolbar
          search={params.search}
          onSearchChange={setSearch}
          placeholder="Name, E-Mail oder Telefon …"
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
          error={error as Error | null}
          onRetry={() => void refetch()}
          sort={params.sort}
          asc={params.asc}
          onSort={toggleSort}
          onRowClick={(row) => navigate(`/kontakte/${row.id}`)}
          selected={selected}
          onSelectedChange={setSelected}
          empty={
            <EmptyState
              icon={Users}
              title={params.search || activeFilterCount ? 'Keine Treffer' : 'Noch keine Kontakte'}
              description={
                params.search || activeFilterCount
                  ? 'Andere Suchbegriffe oder Filter probieren.'
                  : 'Lege den ersten Kontakt an oder importiere den Bestand aus sevDesk.'
              }
              action={
                <Button size="sm" onClick={() => setCreateOpen(true)}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Kontakt anlegen
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
              Inhaber setzen
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start">
            {profiles.map((p) => (
              <DropdownMenuItem key={p.id} onSelect={() => void assignOwner(p.id)}>
                {p.full_name ?? p.email}
              </DropdownMenuItem>
            ))}
            <DropdownMenuItem onSelect={() => void assignOwner(null)}>
              Keinen Inhaber
            </DropdownMenuItem>
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

      <ContactDialog open={createOpen} onOpenChange={setCreateOpen} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`${selected.size} ${selected.size === 1 ? 'Kontakt' : 'Kontakte'} löschen?`}
        description="Zugehörige Aufgaben und Notizen werden mitgelöscht. Das lässt sich nicht rückgängig machen."
        confirmLabel="Löschen"
        destructive
        onConfirm={doDelete}
      />
    </>
  );
}
