import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { ArrowLeft, Check, Pencil, Plus, RotateCcw, Trash2, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { dateShort, money, percent } from '@/lib/format';
import {
  useDeal,
  useDealStageHistory,
  useDeleteDeals,
  useLoseDeal,
  useMoveDeal,
  useReopenDeal,
  useWinDeal,
} from '@/features/deals/api';
import { useLostReasons, useStages } from '@/features/meta/api';
import { useTimeline } from '@/features/activities/api';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Textarea } from '@/components/ui/textarea';
import { Timeline } from '@/components/crm/Timeline';
import { ActivityDialog } from '@/components/crm/ActivityDialog';
import { ConfirmDialog } from '@/components/crm/ConfirmDialog';
import { PropertyRow, StatusBadge } from '@/components/crm/primitives';
import { TagPicker } from '@/components/crm/TagPicker';
import { DocumentPanel } from '@/components/crm/DocumentPanel';
import { DealDialog } from './DealDialog';

export default function DealDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { data: deal, isPending } = useDeal(id);
  const { data: stages = [] } = useStages(deal?.pipeline_id);
  const { data: history = [] } = useDealStageHistory(id);
  const { data: timeline = [], isPending: timelinePending } = useTimeline('deal_id', id);
  const { data: lostReasons = [] } = useLostReasons();

  const move = useMoveDeal();
  const win = useWinDeal();
  const lose = useLoseDeal();
  const reopen = useReopenDeal();
  const remove = useDeleteDeals();

  const [editOpen, setEditOpen] = useState(false);
  const [activityOpen, setActivityOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [loseOpen, setLoseOpen] = useState(false);
  const [reasonId, setReasonId] = useState<string | undefined>();
  const [comment, setComment] = useState('');

  if (isPending) {
    return (
      <div className="space-y-4 p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!deal) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Dieser Deal existiert nicht (mehr).</p>
        <Button variant="link" className="px-0" onClick={() => navigate('/deals')}>
          Zurück zum Board
        </Button>
      </div>
    );
  }

  const currentIndex = stages.findIndex((s) => s.id === deal.stage_id);

  const changeStage = async (stageId: string) => {
    try {
      await move.mutateAsync({ dealId: deal.id, stageId });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const doLose = async () => {
    try {
      await lose.mutateAsync({ dealId: deal.id, reasonId: reasonId ?? null, comment: comment.trim() || null });
      toast.success('Deal als verloren markiert');
      setLoseOpen(false);
      setReasonId(undefined);
      setComment('');
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const doDelete = async () => {
    await remove.mutateAsync([deal.id]);
    toast.success('Deal gelöscht');
    navigate('/deals');
  };

  return (
    <>
      <div className="border-b border-border px-4 py-4 sm:px-6">
        <Button
          variant="ghost"
          size="sm"
          className="-ml-2 mb-2 h-7 text-muted-foreground"
          onClick={() => navigate('/deals')}
        >
          <ArrowLeft className="mr-1.5 h-3.5 w-3.5" />
          Deals
        </Button>

        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="truncate text-xl font-semibold tracking-tight">{deal.title}</h1>
            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
              <span className="text-lg font-semibold tabular-nums">{money(deal.value)}</span>
              <StatusBadge kind="deal" value={deal.status} />
              {deal.companies && (
                <Link
                  to={`/firmen/${deal.companies.id}`}
                  className="text-muted-foreground hover:text-primary hover:underline"
                >
                  {deal.companies.name}
                </Link>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {deal.status === 'open' ? (
              <>
                <Button
                  size="sm"
                  className="bg-success text-success-foreground hover:bg-success/90"
                  onClick={() => void win.mutateAsync(deal.id)}
                  disabled={win.isPending}
                >
                  <Check className="mr-1.5 h-4 w-4" />
                  Gewonnen
                </Button>
                <Button variant="outline" size="sm" onClick={() => setLoseOpen(true)}>
                  <X className="mr-1.5 h-4 w-4" />
                  Verloren
                </Button>
              </>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={() => void reopen.mutateAsync(deal.id)}
                disabled={reopen.isPending}
              >
                <RotateCcw className="mr-1.5 h-4 w-4" />
                Wieder öffnen
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => setEditOpen(true)}>
              <Pencil className="mr-1.5 h-4 w-4" />
              Bearbeiten
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="h-9 w-9 text-destructive hover:text-destructive"
              onClick={() => setConfirmDelete(true)}
              aria-label="Deal löschen"
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Phasenleiste: jede Phase ist anklickbar, der Fortschritt ist gefüllt */}
        {deal.status === 'open' && stages.length > 0 && (
          <nav className="mt-4 flex gap-1 overflow-x-auto pb-1" aria-label="Phase wechseln">
            {stages.map((stage, index) => {
              const reached = index <= currentIndex;
              const current = stage.id === deal.stage_id;
              return (
                <button
                  key={stage.id}
                  type="button"
                  onClick={() => changeStage(stage.id)}
                  disabled={move.isPending}
                  title={`${stage.name} · ${stage.probability} %`}
                  className={cn(
                    'group relative min-w-[104px] flex-1 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors',
                    reached
                      ? 'bg-primary text-primary-foreground'
                      : 'bg-secondary text-muted-foreground hover:bg-surface-hover',
                    current && 'ring-2 ring-primary ring-offset-1',
                  )}
                >
                  <span className="block truncate">{stage.name}</span>
                </button>
              );
            })}
          </nav>
        )}
      </div>

      <div className="grid gap-6 p-4 sm:p-6 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-6">
          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Details</h2>
            <dl>
              <PropertyRow label="Phase">{deal.stages?.name ?? '—'}</PropertyRow>
              <PropertyRow label="Wahrscheinlichkeit">
                {percent(deal.probability ?? deal.stages?.probability)}
              </PropertyRow>
              <PropertyRow label="Abschluss">
                {deal.expected_close_date ? (
                  dateShort(deal.expected_close_date)
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </PropertyRow>
              <PropertyRow label="Kontakt">
                {deal.contacts ? (
                  <Link
                    to={`/kontakte/${deal.contacts.id}`}
                    className="hover:text-primary hover:underline"
                  >
                    {deal.contacts.full_name}
                  </Link>
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </PropertyRow>
              <PropertyRow label="Inhaber">
                {deal.owner?.full_name ?? <span className="text-muted-foreground">—</span>}
              </PropertyRow>
              <PropertyRow label="Angelegt">{dateShort(deal.created_at)}</PropertyRow>
              {deal.status === 'won' && (
                <PropertyRow label="Gewonnen">{dateShort(deal.won_at)}</PropertyRow>
              )}
              {deal.status === 'lost' && (
                <>
                  <PropertyRow label="Verloren">{dateShort(deal.lost_at)}</PropertyRow>
                  <PropertyRow label="Grund">
                    {deal.lost_reasons?.label ?? <span className="text-muted-foreground">—</span>}
                  </PropertyRow>
                  {deal.lost_comment && (
                    <PropertyRow label="Kommentar">{deal.lost_comment}</PropertyRow>
                  )}
                </>
              )}
            </dl>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Tags</h2>
            <TagPicker entity="deal" entityId={deal.id} />
          </section>

          <DocumentPanel parent={{ deal_id: deal.id }} />

          <section className="rounded-lg border border-border bg-card p-4">
            <h2 className="mb-2 text-sm font-semibold">Phasenverlauf</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Kein Verlauf.</p>
            ) : (
              <ol className="space-y-2 text-sm">
                {history.map((entry) => (
                  <li key={entry.id} className="flex items-baseline justify-between gap-2">
                    <span className="truncate">{entry.to_stage?.name ?? '—'}</span>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {dateShort(entry.changed_at)}
                    </span>
                  </li>
                ))}
              </ol>
            )}
          </section>
        </aside>

        <section className="min-w-0">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-semibold">Verlauf</h2>
            <Button variant="outline" size="sm" onClick={() => setActivityOpen(true)}>
              <Plus className="mr-1.5 h-4 w-4" />
              Aufgabe
            </Button>
          </div>
          <Timeline items={timeline} loading={timelinePending} parent={{ deal_id: deal.id }} />
        </section>
      </div>

      <DealDialog open={editOpen} onOpenChange={setEditOpen} deal={deal} />
      <ActivityDialog
        open={activityOpen}
        onOpenChange={setActivityOpen}
        parent={{ deal_id: deal.id }}
      />

      <Dialog open={loseOpen} onOpenChange={setLoseOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Deal als verloren markieren</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label>Grund</Label>
              <Select value={reasonId} onValueChange={setReasonId}>
                <SelectTrigger className="h-9">
                  <SelectValue placeholder="Grund wählen" />
                </SelectTrigger>
                <SelectContent>
                  {lostReasons.map((r) => (
                    <SelectItem key={r.id} value={r.id}>
                      {r.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="comment">Kommentar</Label>
              <Textarea
                id="comment"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={3}
                className="resize-none"
                placeholder="Was war ausschlaggebend?"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLoseOpen(false)}>
              Abbrechen
            </Button>
            <Button variant="destructive" onClick={doLose} disabled={lose.isPending}>
              Als verloren markieren
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={`„${deal.title}" löschen?`}
        description="Zugehörige Aufgaben und Notizen werden mitgelöscht."
        confirmLabel="Löschen"
        destructive
        onConfirm={doDelete}
      />
    </>
  );
}
