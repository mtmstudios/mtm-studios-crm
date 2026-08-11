import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Handshake, LayoutGrid, List, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { money, num } from '@/lib/format';
import { useDebounce } from '@/hooks/useDebounce';
import { usePipelines, useProfiles } from '@/features/meta/api';
import {
  useBoardDeals,
  useBoardSummary,
  useMoveDeal,
  type DealRow,
} from '@/features/deals/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { EmptyState, PageHeader } from '@/components/crm/primitives';
import { DealCard } from './DealCard';
import { DealColumn } from './DealColumn';
import { DealDialog } from './DealDialog';
import DealList from './DealList';

export default function DealBoard() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { data: pipelines = [], isPending: pipelinesPending } = usePipelines();
  const { data: profiles = [] } = useProfiles();
  const move = useMoveDeal();

  const view = searchParams.get('ansicht') === 'liste' ? 'liste' : 'board';
  const ownerId = searchParams.get('inhaber');
  const [term, setTerm] = useState(searchParams.get('q') ?? '');
  const search = useDebounce(term, 300);

  const pipelineId = searchParams.get('pipeline') ?? pipelines.find((p) => p.is_default)?.id ?? pipelines[0]?.id;
  const pipeline = pipelines.find((p) => p.id === pipelineId);
  const stages = useMemo(() => pipeline?.stages ?? [], [pipeline]);

  const { data: deals, isPending } = useBoardDeals({ pipelineId: pipelineId ?? '', ownerId, search });
  const { data: summary } = useBoardSummary({ pipelineId: pipelineId ?? '', ownerId });

  const createOpen = searchParams.get('neu') === '1';

  const setParam = (key: string, value: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (value) next.set(key, value);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  /* --------------------------------------------------------- Drag & Drop -- */

  // Lokale Kopie der Spalten: sie folgt dem Zeiger sofort, während die
  // Mutation noch läuft. Ohne das springt die Karte sichtbar zurück.
  const [columns, setColumns] = useState<Record<string, DealRow[]>>({});
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (!deals) return;
    const next: Record<string, DealRow[]> = {};
    for (const stage of stages) next[stage.id] = [];
    for (const deal of deals) (next[deal.stage_id] ??= []).push(deal);
    setColumns(next);
  }, [deals, stages]);

  const sensors = useSensors(
    // Kleine Schwelle, damit ein Klick auf die Karte weiterhin navigiert
    // und nicht als Ziehen gewertet wird.
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  const activeDeal = activeId
    ? Object.values(columns).flat().find((d) => d.id === activeId) ?? null
    : null;

  const columnOf = (id: string): string | null => {
    if (columns[id]) return id; // die Spalte selbst
    return Object.keys(columns).find((key) => columns[key].some((d) => d.id === id)) ?? null;
  };

  const onDragStart = (event: DragStartEvent) => setActiveId(String(event.active.id));

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const from = columnOf(String(active.id));
    const to = columnOf(String(over.id));
    if (!from || !to || from === to) return;

    // Karte beim Überfahren schon in die Zielspalte übernehmen
    setColumns((prev) => {
      const card = prev[from].find((d) => d.id === active.id);
      if (!card) return prev;

      const overIndex = prev[to].findIndex((d) => d.id === over.id);
      const target = [...prev[to]];
      target.splice(overIndex >= 0 ? overIndex : target.length, 0, card);

      return {
        ...prev,
        [from]: prev[from].filter((d) => d.id !== active.id),
        [to]: target,
      };
    });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setActiveId(null);
    if (!over) return;

    const stageId = columnOf(String(over.id));
    if (!stageId) return;

    const list = columns[stageId] ?? [];
    const index = list.findIndex((d) => d.id === active.id);
    if (index === -1) return;

    // Nachbarn bestimmen: daraus errechnet die Datenbank die neue Position
    const afterId = index > 0 ? list[index - 1].id : null;
    const beforeId = index < list.length - 1 ? list[index + 1].id : null;

    try {
      await move.mutateAsync({ dealId: String(active.id), stageId, beforeId, afterId });
    } catch (err) {
      toast.error(`Verschieben fehlgeschlagen: ${(err as Error).message}`);
    }
  };

  /* ------------------------------------------------------------ Ausgabe -- */

  if (pipelinesPending) {
    return (
      <div className="p-6">
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (!pipeline) {
    return (
      <div className="py-16">
        <EmptyState
          icon={Handshake}
          title="Keine Pipeline vorhanden"
          description="Lege in den Einstellungen eine Pipeline mit Phasen an."
          action={
            <Button size="sm" onClick={() => navigate('/einstellungen/pipelines')}>
              Zu den Einstellungen
            </Button>
          }
        />
      </div>
    );
  }

  const totalOpen = [...(summary?.values() ?? [])].reduce((sum, s) => sum + Number(s.total_value), 0);
  const totalCount = [...(summary?.values() ?? [])].reduce((sum, s) => sum + Number(s.deal_count), 0);

  return (
    <>
      <PageHeader
        title="Deals"
        subtitle={summary ? `${num(totalCount)} offen · ${money(totalOpen)}` : undefined}
      >
        <Button size="sm" onClick={() => setParam('neu', '1')}>
          <Plus className="mr-1.5 h-4 w-4" />
          Deal
        </Button>
      </PageHeader>

      <div className="flex flex-wrap items-center gap-2 px-4 py-3 sm:px-6">
        <Input
          value={term}
          onChange={(e) => setTerm(e.target.value)}
          placeholder="Deal suchen …"
          className="h-9 w-full sm:max-w-xs"
        />

        {pipelines.length > 1 && (
          <Select value={pipeline.id} onValueChange={(v) => setParam('pipeline', v)}>
            <SelectTrigger className="h-9 w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {pipelines.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        <Select
          value={ownerId ?? 'alle'}
          onValueChange={(v) => setParam('inhaber', v === 'alle' ? null : v)}
        >
          <SelectTrigger className="h-9 w-[180px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="alle">Alle Inhaber</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="ml-auto flex items-center rounded-md border border-input">
          <Button
            variant={view === 'board' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 rounded-r-none"
            onClick={() => setParam('ansicht', null)}
            aria-label="Board-Ansicht"
          >
            <LayoutGrid className="h-4 w-4" />
          </Button>
          <Button
            variant={view === 'liste' ? 'secondary' : 'ghost'}
            size="sm"
            className="h-8 rounded-l-none"
            onClick={() => setParam('ansicht', 'liste')}
            aria-label="Listenansicht"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {view === 'liste' ? (
        <DealList />
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCorners}
          onDragStart={onDragStart}
          onDragOver={onDragOver}
          onDragEnd={onDragEnd}
          onDragCancel={() => setActiveId(null)}
        >
          {/* Auf dem Telefon rastet je eine Spalte ein, statt dass man
              zwischen zwei Phasen stehen bleibt. */}
          <div className="scrollbar-slim snap-columns flex gap-3 overflow-x-auto px-4 pb-6 sm:snap-none sm:px-6">
            {stages.map((stage) => {
              const cards = columns[stage.id] ?? [];
              const stats = summary?.get(stage.id);
              return (
                <DealColumn
                  key={stage.id}
                  stage={stage}
                  count={Number(stats?.deal_count ?? cards.length)}
                  value={Number(stats?.total_value ?? 0)}
                  loading={isPending}
                >
                  <SortableContext
                    items={cards.map((d) => d.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {cards.map((deal) => (
                      <DealCard
                        key={deal.id}
                        deal={deal}
                        onOpen={() => navigate(`/deals/${deal.id}`)}
                      />
                    ))}
                  </SortableContext>
                </DealColumn>
              );
            })}
          </div>

          {/* Die gezogene Karte folgt dem Zeiger außerhalb des Spaltenflusses */}
          <DragOverlay>
            {activeDeal && <DealCard deal={activeDeal} overlay />}
          </DragOverlay>
        </DndContext>
      )}

      <DealDialog
        open={createOpen}
        onOpenChange={(open) => setParam('neu', open ? '1' : null)}
        defaultPipelineId={pipeline.id}
        defaultStageId={stages[0]?.id}
      />
    </>
  );
}
