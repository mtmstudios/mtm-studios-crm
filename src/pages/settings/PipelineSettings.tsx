import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { GripVertical, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { usePipelines, type Stage } from '@/features/meta/api';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ConfirmDialog } from '@/components/crm/ConfirmDialog';

export default function PipelineSettings() {
  const { isAdmin } = useAuth();
  const { data: pipelines = [], isPending } = usePipelines();
  const qc = useQueryClient();
  const [toDelete, setToDelete] = useState<Stage | null>(null);

  const refresh = () => {
    qc.invalidateQueries({ queryKey: ['pipelines'] });
    qc.invalidateQueries({ queryKey: ['stages'] });
  };

  const saveStage = useMutation({
    mutationFn: async ({ id, ...patch }: Partial<Stage> & { id: string }) => {
      const { error } = await supabase.from('stages').update(patch).eq('id', id);
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (err) => toast.error((err as Error).message),
  });

  const addStage = useMutation({
    mutationFn: async ({ pipelineId, position }: { pipelineId: string; position: number }) => {
      const { error } = await supabase.from('stages').insert({
        pipeline_id: pipelineId,
        name: 'Neue Phase',
        position,
        probability: 50,
      });
      if (error) throw error;
    },
    onSuccess: refresh,
    onError: (err) => toast.error((err as Error).message),
  });

  const deleteStage = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('stages').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      refresh();
      toast.success('Phase gelöscht');
      setToDelete(null);
    },
    onError: (err) =>
      // Der Fremdschlüssel verhindert das Löschen, solange Deals daran hängen
      toast.error(
        (err as Error).message.includes('foreign key')
          ? 'In dieser Phase liegen noch Deals. Verschiebe sie zuerst.'
          : (err as Error).message,
      ),
  });

  if (isPending) return <Skeleton className="h-64 w-full max-w-3xl" />;

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h2 className="text-sm font-semibold">Pipelines und Phasen</h2>
        <p className="text-sm text-muted-foreground">
          Die Wahrscheinlichkeit je Phase geht in den gewichteten Forecast ein. „Liegen bleibt ab"
          markiert Deals im Board, die zu lange in einer Phase stehen.
          {!isAdmin && ' Nur Admins können hier etwas ändern.'}
        </p>
      </div>

      {pipelines.map((pipeline) => (
        <section key={pipeline.id} className="rounded-lg border border-border">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <h3 className="text-sm font-semibold">{pipeline.name}</h3>
            <Button
              variant="outline"
              size="sm"
              disabled={!isAdmin || addStage.isPending}
              onClick={() =>
                addStage.mutate({
                  pipelineId: pipeline.id,
                  position: (pipeline.stages.at(-1)?.position ?? -1) + 1,
                })
              }
            >
              <Plus className="mr-1.5 h-4 w-4" />
              Phase
            </Button>
          </div>

          <div className="divide-y divide-border">
            <div className="hidden grid-cols-[24px_minmax(0,1fr)_100px_120px_40px] gap-3 px-4 py-2 text-xs uppercase tracking-wide text-muted-foreground sm:grid">
              <span />
              <span>Name</span>
              <span>Wahrsch.</span>
              <span>Liegt ab (Tage)</span>
              <span />
            </div>

            {pipeline.stages.map((stage) => (
              <div
                key={stage.id}
                className="grid grid-cols-[24px_minmax(0,1fr)_100px_120px_40px] items-center gap-3 px-4 py-2"
              >
                <GripVertical className="h-4 w-4 text-muted-foreground/50" />

                <Input
                  defaultValue={stage.name}
                  disabled={!isAdmin}
                  className="h-8"
                  aria-label="Phasenname"
                  // Erst beim Verlassen speichern — sonst ein Request je Zeichen
                  onBlur={(e) => {
                    const name = e.target.value.trim();
                    if (name && name !== stage.name) saveStage.mutate({ id: stage.id, name });
                  }}
                />

                <div className="relative">
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    defaultValue={stage.probability}
                    disabled={!isAdmin}
                    className="h-8 pr-6"
                    aria-label="Wahrscheinlichkeit in Prozent"
                    onBlur={(e) => {
                      const probability = Math.min(100, Math.max(0, Number(e.target.value) || 0));
                      if (probability !== stage.probability)
                        saveStage.mutate({ id: stage.id, probability });
                    }}
                  />
                  <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    %
                  </span>
                </div>

                <Input
                  type="number"
                  min={0}
                  defaultValue={stage.rotting_days ?? ''}
                  disabled={!isAdmin}
                  placeholder="—"
                  className="h-8"
                  aria-label="Tage bis Liegenbleiben"
                  onBlur={(e) => {
                    const raw = e.target.value.trim();
                    const rotting_days = raw === '' ? null : Number(raw);
                    if (rotting_days !== stage.rotting_days)
                      saveStage.mutate({ id: stage.id, rotting_days });
                  }}
                />

                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                  disabled={!isAdmin || pipeline.stages.length <= 1}
                  onClick={() => setToDelete(stage)}
                  aria-label="Phase löschen"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        </section>
      ))}

      <ConfirmDialog
        open={!!toDelete}
        onOpenChange={(open) => !open && setToDelete(null)}
        title={`Phase „${toDelete?.name}" löschen?`}
        description="Das geht nur, wenn in der Phase keine Deals mehr liegen."
        confirmLabel="Löschen"
        destructive
        onConfirm={async () => {
          if (toDelete) await deleteStage.mutateAsync(toDelete.id);
        }}
      />
    </div>
  );
}
