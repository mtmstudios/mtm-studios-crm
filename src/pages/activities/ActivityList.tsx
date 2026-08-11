import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { CheckSquare, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { dateRelative } from '@/lib/format';
import { useListParams } from '@/hooks/useListParams';
import {
  useActivities,
  useDeleteActivities,
  useToggleActivity,
  type ActivityRow,
} from '@/features/activities/api';
import { useProfiles } from '@/features/meta/api';
import { DataTable, type Column } from '@/components/data/DataTable';
import { ListToolbar } from '@/components/data/ListToolbar';
import { TablePagination } from '@/components/data/TablePagination';
import {
  ACTIVITY_LABEL,
  ACTIVITY_OPTIONS,
  BulkBar,
  EmptyState,
  PageHeader,
} from '@/components/crm/primitives';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { ConfirmDialog } from '@/components/crm/ConfirmDialog';
import { ActivityDialog } from '@/components/crm/ActivityDialog';
import type { Activity } from '@/features/activities/api';

export default function ActivityList() {
  const { params, setSearch, setPage, setPageSize, toggleSort, setFilter, clearFilters, activeFilterCount } =
    useListParams('due_at', true);

  const { data, isFetching, error, refetch } = useActivities(params);
  const { data: profiles = [] } = useProfiles();
  const toggle = useToggleActivity();
  const remove = useDeleteActivities();

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Activity | null>(null);

  const filters = useMemo(
    () => [
      { column: 'type', label: 'Art', options: ACTIVITY_OPTIONS },
      {
        column: 'done',
        label: 'Status',
        options: [
          { value: 'false', label: 'Offen' },
          { value: 'true', label: 'Erledigt' },
        ],
      },
      { column: 'overdue', label: 'Überfällig', options: [{ value: 'true', label: 'Nur überfällige' }] },
      {
        column: 'owner_id',
        label: 'Zuständig',
        options: [
          { value: 'none', label: 'Niemand' },
          ...profiles.map((p) => ({ value: p.id, label: p.full_name ?? p.email })),
        ],
      },
    ],
    [profiles],
  );

  const columns: Column<ActivityRow>[] = [
    {
      key: 'done',
      header: '',
      className: 'w-9',
      render: (row) => (
        <span onClick={(e) => e.stopPropagation()}>
          <Checkbox
            checked={row.done}
            onCheckedChange={(checked) => toggle.mutate({ id: row.id, done: checked === true })}
            aria-label="Als erledigt markieren"
          />
        </span>
      ),
    },
    {
      key: 'subject',
      header: 'Betreff',
      sortable: true,
      render: (row) => (
        <div className="min-w-0">
          <div className={cn('truncate font-medium', row.done && 'text-muted-foreground line-through')}>
            {row.subject}
          </div>
          {row.notes && <div className="truncate text-xs text-muted-foreground">{row.notes}</div>}
        </div>
      ),
    },
    {
      key: 'type',
      header: 'Art',
      sortable: true,
      className: 'w-28',
      hideBelow: 'sm',
      render: (row) => <span className="text-muted-foreground">{ACTIVITY_LABEL[row.type]}</span>,
    },
    {
      key: 'related',
      header: 'Verknüpft mit',
      hideBelow: 'md',
      render: (row) => {
        // Ein Eintrag kann an mehreren Objekten hängen; das spezifischste
        // zuerst zeigen — der Deal sagt am meisten aus.
        if (row.deals) return <Link to={`/deals/${row.deals.id}`} className="truncate hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{row.deals.title}</Link>;
        if (row.contacts) return <Link to={`/kontakte/${row.contacts.id}`} className="truncate hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{row.contacts.full_name}</Link>;
        if (row.companies) return <Link to={`/firmen/${row.companies.id}`} className="truncate hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{row.companies.name}</Link>;
        return <span className="text-muted-foreground">—</span>;
      },
    },
    {
      key: 'due_at',
      header: 'Fällig',
      sortable: true,
      className: 'w-36',
      render: (row) => {
        const overdue = !row.done && row.due_at && new Date(row.due_at) < new Date();
        return (
          <span className={cn('text-muted-foreground', overdue && 'font-medium text-destructive')}>
            {row.due_at ? dateRelative(row.due_at) : '—'}
          </span>
        );
      },
    },
    {
      key: 'owner',
      header: 'Zuständig',
      hideBelow: 'xl',
      render: (row) => (
        <span className="truncate text-muted-foreground">{row.owner?.full_name ?? '—'}</span>
      ),
    },
  ];

  const doDelete = async () => {
    const ids = [...selected];
    await remove.mutateAsync(ids);
    toast.success(`${ids.length} Aufgaben gelöscht`);
    setSelected(new Set());
    setConfirmDelete(false);
  };

  return (
    <>
      <PageHeader title="Aufgaben" subtitle={data ? `${data.total} Einträge` : undefined}>
        <Button
          size="sm"
          onClick={() => {
            setEditing(null);
            setDialogOpen(true);
          }}
        >
          <Plus className="mr-1.5 h-4 w-4" />
          Aufgabe
        </Button>
      </PageHeader>

      <div className="px-4 py-3 sm:px-6">
        <ListToolbar
          search={params.search}
          onSearchChange={setSearch}
          placeholder="Betreff oder Notiz …"
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
          onRowClick={(row) => {
            setEditing(row);
            setDialogOpen(true);
          }}
          selected={selected}
          onSelectedChange={setSelected}
          renderMobileCard={(row) => {
            const overdue = !row.done && row.due_at && new Date(row.due_at) < new Date();
            return (
              <div className="flex items-start gap-3">
                <span onClick={(e) => e.stopPropagation()} className="pt-0.5">
                  <Checkbox
                    checked={row.done}
                    onCheckedChange={(checked) =>
                      toggle.mutate({ id: row.id, done: checked === true })
                    }
                    aria-label="Als erledigt markieren"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className={cn('truncate font-medium', row.done && 'text-muted-foreground line-through')}>
                    {row.subject}
                  </div>
                  <div className="truncate text-xs text-muted-foreground">
                    {ACTIVITY_LABEL[row.type]}
                    {row.due_at && (
                      <>
                        {' · '}
                        <span className={cn(overdue && 'font-medium text-destructive')}>
                          {dateRelative(row.due_at)}
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          }}
          empty={
            <EmptyState
              icon={CheckSquare}
              title={params.search || activeFilterCount ? 'Keine Treffer' : 'Keine Aufgaben'}
              description="Aufgaben lassen sich auch direkt an Kontakten, Firmen und Deals anlegen."
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

      <ActivityDialog open={dialogOpen} onOpenChange={setDialogOpen} activity={editing} />

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`${selected.size} ${selected.size === 1 ? 'Aufgabe' : 'Aufgaben'} löschen?`}
        confirmLabel="Löschen"
        destructive
        onConfirm={doDelete}
      />
    </>
  );
}
