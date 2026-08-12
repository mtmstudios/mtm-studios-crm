import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import {
  DndContext,
  DragOverlay,
  PointerSensor,
  closestCorners,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragOverEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, useSortable, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { ArrowLeft, Building2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { dateRelative, dateShort, initials, num } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { useCreateActivity, useToggleActivity, type Activity } from '@/features/activities/api';
import {
  STATUS_LABEL,
  STATUS_OPTIONEN,
  STATUS_TON,
  useCreateSection,
  useDeleteProject,
  useMoveTask,
  useProject,
  useProjectSections,
  useProjectTasks,
  useUpdateProject,
} from '@/features/projects/api';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/crm/ConfirmDialog';
import { DocumentPanel } from '@/components/crm/DocumentPanel';
import { ActivityDialog } from '@/components/crm/ActivityDialog';
import { ProjectDialog } from './ProjectDialog';
import type { ProjectStatus } from '@/integrations/supabase/types';

type Aufgabe = Activity & {
  owner: { id: string; full_name: string | null } | null;
  companies: { id: string; name: string } | null;
};

/* ----------------------------------------------------------------- Karte -- */

function AufgabenKarte({
  aufgabe,
  onOeffnen,
  overlay,
}: {
  aufgabe: Aufgabe;
  onOeffnen?(): void;
  overlay?: boolean;
}) {
  const sortable = useSortable({ id: aufgabe.id, disabled: overlay });
  const toggle = useToggleActivity();
  const ueberfaellig = !aufgabe.done && aufgabe.due_at && new Date(aufgabe.due_at) < new Date();

  return (
    <article
      ref={overlay ? undefined : sortable.setNodeRef}
      style={
        overlay
          ? undefined
          : { transform: CSS.Translate.toString(sortable.transform), transition: sortable.transition }
      }
      {...(overlay ? {} : sortable.attributes)}
      {...(overlay ? {} : sortable.listeners)}
      className={cn(
        'cursor-grab rounded-md border border-border bg-card p-2.5 shadow-sm transition-shadow hover:shadow-md active:cursor-grabbing',
        !overlay && sortable.isDragging && 'dragging',
        overlay && 'rotate-2 cursor-grabbing shadow-lg',
      )}
    >
      <div className="flex items-start gap-2">
        {/* Klick auf den Haken darf die Karte nicht öffnen oder ziehen */}
        <span
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
          className="mt-0.5"
        >
          <Checkbox
            checked={aufgabe.done}
            onCheckedChange={(c) => toggle.mutate({ id: aufgabe.id, done: c === true })}
            aria-label="Als erledigt markieren"
          />
        </span>
        <button type="button" onClick={onOeffnen} className="min-w-0 flex-1 text-left">
          <span
            className={cn(
              'block text-sm font-medium leading-snug',
              aufgabe.done && 'text-muted-foreground line-through',
            )}
          >
            {aufgabe.subject}
          </span>
        </button>
      </div>

      {(aufgabe.due_at || aufgabe.owner) && (
        <div className="mt-2 flex items-center justify-between gap-2 pl-6 text-xs">
          <span className={cn('text-muted-foreground', ueberfaellig && 'font-medium text-destructive')}>
            {aufgabe.due_at ? dateRelative(aufgabe.due_at) : ''}
          </span>
          {aufgabe.owner?.full_name && (
            <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-secondary text-[9px] font-semibold text-secondary-foreground">
              {initials(aufgabe.owner.full_name)}
            </span>
          )}
        </div>
      )}
    </article>
  );
}

/* ----------------------------------------------------------------- Spalte -- */

function Spalte({
  id,
  name,
  aufgaben,
  onNeu,
  children,
}: {
  id: string;
  name: string;
  aufgaben: Aufgabe[];
  onNeu(titel: string): void;
  children: React.ReactNode;
}) {
  const { setNodeRef, isOver } = useDroppable({ id });
  const [entwurf, setEntwurf] = useState('');
  const [offen, setOffen] = useState(false);
  const erledigt = aufgaben.filter((a) => a.done).length;

  return (
    <section className="flex w-[280px] shrink-0 flex-col">
      <header className="mb-2 flex items-baseline justify-between gap-2 px-1">
        <h2 className="truncate text-sm font-semibold">{name}</h2>
        <span className="shrink-0 text-xs text-muted-foreground">
          {erledigt > 0 ? `${num(erledigt)}/${num(aufgaben.length)}` : num(aufgaben.length)}
        </span>
      </header>

      <div
        ref={setNodeRef}
        className={cn(
          'flex min-h-[120px] flex-1 flex-col gap-2 rounded-lg p-1.5 transition-colors',
          isOver ? 'bg-primary/5 ring-1 ring-inset ring-primary/20' : 'bg-surface',
        )}
      >
        {children}

        {offen ? (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const t = entwurf.trim();
              if (t) onNeu(t);
              setEntwurf('');
              // offen lassen: mehrere Aufgaben hintereinander erfassen
            }}
          >
            <Input
              value={entwurf}
              onChange={(e) => setEntwurf(e.target.value)}
              onBlur={() => !entwurf.trim() && setOffen(false)}
              onKeyDown={(e) => e.key === 'Escape' && setOffen(false)}
              placeholder="Aufgabe … (Enter)"
              autoFocus
              className="h-9 bg-card"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setOffen(true)}
            className="rounded-md py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-hover hover:text-foreground"
          >
            <Plus className="mr-1 inline h-3 w-3" />
            Aufgabe
          </button>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ Seite -- */

export default function ProjectDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const { data: projekt, isPending } = useProject(id);
  const { data: abschnitte = [] } = useProjectSections(id);
  const { data: aufgaben = [] } = useProjectTasks(id);
  const move = useMoveTask(id ?? '');
  const createTask = useCreateActivity();
  const createSection = useCreateSection(id ?? '');
  const update = useUpdateProject();
  const remove = useDeleteProject();

  const [bearbeiten, setBearbeiten] = useState(false);
  const [loeschen, setLoeschen] = useState(false);
  const [aufgabeOffen, setAufgabeOffen] = useState<Activity | null>(null);
  const [neuerAbschnitt, setNeuerAbschnitt] = useState('');

  const [spalten, setSpalten] = useState<Record<string, Aufgabe[]>>({});
  const [aktiv, setAktiv] = useState<string | null>(null);

  useEffect(() => {
    const next: Record<string, Aufgabe[]> = { ohne: [] };
    for (const a of abschnitte) next[a.id] = [];
    for (const t of aufgaben) {
      const key = t.section_id && next[t.section_id] ? t.section_id : 'ohne';
      next[key].push(t as Aufgabe);
    }
    setSpalten(next);
  }, [aufgaben, abschnitte]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const aktiveAufgabe = aktiv ? Object.values(spalten).flat().find((a) => a.id === aktiv) ?? null : null;

  const spalteVon = (key: string): string | null => {
    if (spalten[key]) return key;
    return Object.keys(spalten).find((s) => spalten[s].some((a) => a.id === key)) ?? null;
  };

  const onDragOver = (event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;
    const von = spalteVon(String(active.id));
    const nach = spalteVon(String(over.id));
    if (!von || !nach || von === nach) return;

    setSpalten((prev) => {
      const karte = prev[von].find((a) => a.id === active.id);
      if (!karte) return prev;
      const index = prev[nach].findIndex((a) => a.id === over.id);
      const ziel = [...prev[nach]];
      ziel.splice(index >= 0 ? index : ziel.length, 0, karte);
      return { ...prev, [von]: prev[von].filter((a) => a.id !== active.id), [nach]: ziel };
    });
  };

  const onDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;
    setAktiv(null);
    if (!over) return;
    const sectionId = spalteVon(String(over.id));
    // "ohne" ist keine echte Spalte — dorthin lässt sich nicht ablegen
    if (!sectionId || sectionId === 'ohne') return;

    const liste = spalten[sectionId] ?? [];
    const index = liste.findIndex((a) => a.id === active.id);
    if (index === -1) return;

    try {
      await move.mutateAsync({
        taskId: String(active.id),
        sectionId,
        afterId: index > 0 ? liste[index - 1].id : null,
        beforeId: index < liste.length - 1 ? liste[index + 1].id : null,
      });
    } catch (err) {
      toast.error(`Verschieben fehlgeschlagen: ${(err as Error).message}`);
    }
  };

  const neueAufgabe = async (sectionId: string, titel: string) => {
    if (!id) return;
    try {
      await createTask.mutateAsync({
        subject: titel,
        type: 'task',
        project_id: id,
        section_id: sectionId,
        company_id: projekt?.company_id ?? null,
        owner_id: user?.id ?? null,
        created_by: user?.id ?? null,
        done: false,
        position: ((spalten[sectionId]?.length ?? 0) + 1) * 1024,
      });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const fortschritt = useMemo(() => {
    const gesamt = aufgaben.length;
    const fertig = aufgaben.filter((a) => a.done).length;
    return { gesamt, fertig, anteil: gesamt ? (fertig / gesamt) * 100 : 0 };
  }, [aufgaben]);

  if (isPending) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-48 w-full" />
      </div>
    );
  }

  if (!projekt) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Dieses Projekt existiert nicht (mehr).</p>
        <Button variant="link" className="px-0" onClick={() => navigate('/projekte')}>
          Zurück zur Übersicht
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 h-7 text-muted-foreground"
          onClick={() => navigate('/projekte')}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Projekte
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{projekt.name}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
              {projekt.companies && (
                <Link
                  to={`/firmen/${projekt.companies.id}`}
                  className="inline-flex items-center gap-1 hover:text-primary hover:underline"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  {projekt.companies.name}
                </Link>
              )}
              {projekt.due_on && <span>fällig {dateShort(projekt.due_on)}</span>}
              <span>
                {num(fortschritt.fertig)} von {num(fortschritt.gesamt)} erledigt
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={projekt.status}
              onValueChange={(v) =>
                update.mutate({
                  id: projekt.id,
                  status: v as ProjectStatus,
                  completed_at: v === 'abgeschlossen' ? new Date().toISOString() : null,
                })
              }
            >
              <SelectTrigger className="h-9 w-[150px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONEN.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button variant="outline" size="sm" onClick={() => setBearbeiten(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Bearbeiten
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 text-destructive hover:text-destructive"
              onClick={() => setLoeschen(true)}
              aria-label="Projekt löschen"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3">
          <Badge variant="secondary" className={cn('font-medium', STATUS_TON[projekt.status])}>
            {STATUS_LABEL[projekt.status]}
          </Badge>
          <div className="h-1.5 max-w-xs flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                fortschritt.anteil === 100 ? 'bg-success' : 'bg-primary',
              )}
              style={{ width: `${fortschritt.anteil}%` }}
            />
          </div>
        </div>
      </div>

      <DndContext
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragStart={(e: DragStartEvent) => setAktiv(String(e.active.id))}
        onDragOver={onDragOver}
        onDragEnd={onDragEnd}
        onDragCancel={() => setAktiv(null)}
      >
        <div className="scrollbar-slim flex gap-3 overflow-x-auto px-4 py-4 sm:px-6">
          {/* Aufgaben ohne Abschnitt zuerst, damit sie nicht untergehen */}
          {(spalten.ohne?.length ?? 0) > 0 && (
            <Spalte id="ohne" name="Ohne Abschnitt" aufgaben={spalten.ohne} onNeu={() => {}}>
              <SortableContext items={spalten.ohne.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                {spalten.ohne.map((a) => (
                  <AufgabenKarte key={a.id} aufgabe={a} onOeffnen={() => setAufgabeOffen(a)} />
                ))}
              </SortableContext>
            </Spalte>
          )}

          {abschnitte.map((abschnitt) => {
            const liste = spalten[abschnitt.id] ?? [];
            return (
              <Spalte
                key={abschnitt.id}
                id={abschnitt.id}
                name={abschnitt.name}
                aufgaben={liste}
                onNeu={(titel) => void neueAufgabe(abschnitt.id, titel)}
              >
                <SortableContext items={liste.map((a) => a.id)} strategy={verticalListSortingStrategy}>
                  {liste.map((a) => (
                    <AufgabenKarte key={a.id} aufgabe={a} onOeffnen={() => setAufgabeOffen(a)} />
                  ))}
                </SortableContext>
              </Spalte>
            );
          })}

          {/* Abschnitt ergänzen */}
          <div className="w-[240px] shrink-0">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const n = neuerAbschnitt.trim();
                if (!n) return;
                createSection.mutate({ name: n, position: abschnitte.length });
                setNeuerAbschnitt('');
              }}
            >
              <Input
                value={neuerAbschnitt}
                onChange={(e) => setNeuerAbschnitt(e.target.value)}
                placeholder="Abschnitt hinzufügen …"
                className="h-9"
              />
            </form>
          </div>
        </div>

        <DragOverlay>{aktiveAufgabe && <AufgabenKarte aufgabe={aktiveAufgabe} overlay />}</DragOverlay>
      </DndContext>

      <div className="grid gap-6 px-4 pb-8 sm:px-6 lg:grid-cols-2">
        <DocumentPanel parent={{ project_id: projekt.id }} titel="Projektdateien" />
        {projekt.description && (
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Beschreibung</h2>
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">{projekt.description}</p>
          </section>
        )}
      </div>

      <ProjectDialog open={bearbeiten} onOpenChange={setBearbeiten} project={projekt} />
      <ActivityDialog
        open={!!aufgabeOffen}
        onOpenChange={(o) => !o && setAufgabeOffen(null)}
        activity={aufgabeOffen}
      />
      <ConfirmDialog
        open={loeschen}
        onOpenChange={setLoeschen}
        title={`„${projekt.name}" löschen?`}
        description="Aufgaben und Dateien des Projekts werden mitgelöscht."
        confirmLabel="Löschen"
        destructive
        onConfirm={async () => {
          await remove.mutateAsync(projekt.id);
          toast.success('Projekt gelöscht');
          navigate('/projekte');
        }}
      />
    </>
  );
}
