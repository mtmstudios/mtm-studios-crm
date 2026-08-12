import { useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { AlertTriangle, Building2, FolderKanban, Plus } from 'lucide-react';
import { cn } from '@/lib/utils';
import { dateShort, initials, num } from '@/lib/format';
import {
  STATUS_LABEL,
  STATUS_TON,
  useProjectProgress,
  useProjects,
} from '@/features/projects/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { EmptyState, PageHeader } from '@/components/crm/primitives';
import { ProjectDialog } from './ProjectDialog';
import type { ProjectStatus } from '@/integrations/supabase/types';

/** Voreinstellung: was gerade Arbeit macht. Archiv liegt hinter dem Filter. */
const AKTIV: ProjectStatus[] = ['planung', 'laeuft', 'pausiert'];

export default function ProjectList() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const ansicht = searchParams.get('ansicht') ?? 'aktiv';

  const status = ansicht === 'alle' ? undefined : ansicht === 'archiv'
    ? (['abgeschlossen', 'abgebrochen'] as ProjectStatus[])
    : AKTIV;

  const { data: projekte = [], isPending, error } = useProjects({ status });
  const ids = useMemo(() => projekte.map((p) => p.id), [projekte]);
  const { data: fortschritt } = useProjectProgress(ids);

  const neuOffen = searchParams.get('neu') === '1';
  const setParam = (key: string, wert: string | null) => {
    const next = new URLSearchParams(searchParams);
    if (wert) next.set(key, wert);
    else next.delete(key);
    setSearchParams(next, { replace: true });
  };

  return (
    <>
      <PageHeader title="Projekte" subtitle={projekte.length ? `${projekte.length} Projekte` : undefined}>
        <Button size="sm" onClick={() => setParam('neu', '1')}>
          <Plus className="mr-1.5 h-4 w-4" />
          Projekt
        </Button>
      </PageHeader>

      <div className="px-4 py-3 sm:px-6">
        <Tabs value={ansicht} onValueChange={(v) => setParam('ansicht', v === 'aktiv' ? null : v)}>
          <TabsList>
            <TabsTrigger value="aktiv">Aktiv</TabsTrigger>
            <TabsTrigger value="archiv">Archiv</TabsTrigger>
            <TabsTrigger value="alle">Alle</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      <div className="px-4 pb-6 sm:px-6">
        {error && (
          <div className="rounded-lg border border-border p-6 text-center">
            <p className="text-sm font-semibold text-destructive">Projekte konnten nicht geladen werden</p>
            <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-md bg-secondary p-3 text-left text-xs text-muted-foreground">
              {(error as Error).message}
            </pre>
          </div>
        )}

        {isPending && !error && (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-36 w-full" />
            ))}
          </div>
        )}

        {!isPending && !error && projekte.length === 0 && (
          <div className="py-16">
            <EmptyState
              icon={FolderKanban}
              title={ansicht === 'archiv' ? 'Nichts im Archiv' : 'Noch keine Projekte'}
              description="Ein Projekt bündelt die laufende Arbeit an einem Kunden — mit Abschnitten, Aufgaben und Dateien."
              action={
                <Button size="sm" onClick={() => setParam('neu', '1')}>
                  <Plus className="mr-1.5 h-4 w-4" />
                  Projekt anlegen
                </Button>
              }
            />
          </div>
        )}

        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {projekte.map((p) => {
            const f = fortschritt?.get(p.id);
            const anteil = f && f.aufgaben > 0 ? (f.erledigt / f.aufgaben) * 100 : 0;
            const ueberfaellig =
              p.due_on && new Date(p.due_on) < new Date() && p.status !== 'abgeschlossen';

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => navigate(`/projekte/${p.id}`)}
                className="rounded-lg border border-border bg-card p-4 text-left transition-shadow hover:shadow-md"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="line-clamp-2 text-sm font-semibold leading-snug">{p.name}</h3>
                  <Badge variant="secondary" className={cn('shrink-0 font-medium', STATUS_TON[p.status])}>
                    {STATUS_LABEL[p.status]}
                  </Badge>
                </div>

                {p.companies && (
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Building2 className="h-3 w-3 shrink-0" />
                    <span className="truncate">{p.companies.name}</span>
                  </div>
                )}

                <div className="mt-3">
                  <div className="mb-1 flex items-baseline justify-between text-xs">
                    <span className="text-muted-foreground">
                      {f ? `${num(f.erledigt)} von ${num(f.aufgaben)}` : '—'}
                    </span>
                    <span className="tabular-nums text-muted-foreground">{Math.round(anteil)} %</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        anteil === 100 ? 'bg-success' : 'bg-primary',
                      )}
                      style={{ width: `${anteil}%` }}
                    />
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-2 text-xs">
                  <span
                    className={cn(
                      'text-muted-foreground',
                      ueberfaellig && 'font-medium text-destructive',
                    )}
                  >
                    {p.due_on ? `fällig ${dateShort(p.due_on)}` : 'ohne Termin'}
                  </span>
                  <span className="flex items-center gap-2">
                    {f && f.ueberfaellig > 0 && (
                      <span className="inline-flex items-center gap-1 font-medium text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        {num(f.ueberfaellig)}
                      </span>
                    )}
                    {p.owner?.full_name && (
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-secondary text-[9px] font-semibold text-secondary-foreground">
                        {initials(p.owner.full_name)}
                      </span>
                    )}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      <ProjectDialog open={neuOffen} onOpenChange={(o) => setParam('neu', o ? '1' : null)} />
    </>
  );
}
