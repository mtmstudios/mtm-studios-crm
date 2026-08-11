import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowDownRight,
  ArrowUpRight,
  CheckSquare,
  Euro,
  Handshake,
  Target,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { dateRelative, dateShort, growth, money, num } from '@/lib/format';
import { useAuth } from '@/hooks/useAuth';
import { RANGE_LABEL, useDashboardMetrics, useRecentWins, type Range } from '@/features/reports/api';
import { useMyOpenActivities, useToggleActivity } from '@/features/activities/api';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/crm/primitives';

function KpiCard({
  label,
  value,
  hint,
  delta,
  icon: Icon,
}: {
  label: string;
  value: string;
  hint?: string;
  delta?: number | null;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted-foreground">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      <div className="mt-1 flex items-center gap-2 text-xs">
        {delta != null && (
          <span
            className={cn(
              'inline-flex items-center gap-0.5 font-medium',
              delta >= 0 ? 'text-success' : 'text-destructive',
            )}
          >
            {delta >= 0 ? (
              <ArrowUpRight className="h-3 w-3" />
            ) : (
              <ArrowDownRight className="h-3 w-3" />
            )}
            {Math.abs(Math.round(delta))} %
          </span>
        )}
        {hint && <span className="text-muted-foreground">{hint}</span>}
      </div>
    </div>
  );
}

export default function Dashboard() {
  const { profile } = useAuth();
  const [range, setRange] = useState<Range>('30t');
  const [scope, setScope] = useState<'ich' | 'team'>('team');

  const ownerId = scope === 'ich' ? profile?.id : null;
  const { data: metrics, isPending } = useDashboardMetrics(range, ownerId);
  const { data: activities = [] } = useMyOpenActivities(profile?.id);
  const { data: wins = [] } = useRecentWins();
  const toggle = useToggleActivity();

  const winRate =
    metrics && metrics.won_count + metrics.lost_count > 0
      ? (metrics.won_count / (metrics.won_count + metrics.lost_count)) * 100
      : null;

  const maxStageValue = Math.max(1, ...(metrics?.by_stage ?? []).map((s) => Number(s.value)));

  return (
    <>
      <PageHeader
        title={`Hallo${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`}
        subtitle={RANGE_LABEL[range]}
      >
        <Select value={scope} onValueChange={(v) => setScope(v as 'ich' | 'team')}>
          <SelectTrigger className="h-9 w-[130px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="team">Ganzes Team</SelectItem>
            <SelectItem value="ich">Nur ich</SelectItem>
          </SelectContent>
        </Select>
        <Select value={range} onValueChange={(v) => setRange(v as Range)}>
          <SelectTrigger className="h-9 w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {(Object.keys(RANGE_LABEL) as Range[]).map((r) => (
              <SelectItem key={r} value={r}>
                {RANGE_LABEL[r]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </PageHeader>

      <div className="space-y-6 p-4 sm:p-6">
        {isPending || !metrics ? (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-28 w-full" />
            ))}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <KpiCard
              label="Gewonnen"
              value={money(metrics.won_value)}
              hint={`${num(metrics.won_count)} Deals`}
              delta={growth(Number(metrics.won_value), Number(metrics.won_value_prev))}
              icon={Euro}
            />
            <KpiCard
              label="Offene Pipeline"
              value={money(metrics.open_value)}
              hint={`${num(metrics.open_count)} Deals`}
              icon={Handshake}
            />
            <KpiCard
              label="Forecast"
              value={money(metrics.forecast)}
              hint="gewichtet nach Phase"
              icon={TrendingUp}
            />
            <KpiCard
              label="Abschlussquote"
              value={winRate == null ? '—' : `${Math.round(winRate)} %`}
              hint={`${num(metrics.won_count)} zu ${num(metrics.lost_count)}`}
              icon={Target}
            />
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          {/* Pipeline nach Phase */}
          <section className="rounded-lg border border-border bg-card">
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold">Pipeline nach Phase</h2>
              <Button variant="link" size="sm" className="h-auto p-0" asChild>
                <Link to="/deals">Zum Board</Link>
              </Button>
            </div>
            <div className="space-y-3 p-4">
              {(metrics?.by_stage ?? []).length === 0 && (
                <p className="py-6 text-center text-sm text-muted-foreground">
                  Noch keine offenen Deals.
                </p>
              )}
              {(metrics?.by_stage ?? []).map((stage) => (
                <div key={stage.stage_id}>
                  <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                    <span className="truncate font-medium">{stage.name}</span>
                    <span className="shrink-0 text-muted-foreground">
                      {num(stage.count)} · {money(stage.value)}
                    </span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-primary transition-all"
                      style={{ width: `${(Number(stage.value) / maxStageValue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <div className="space-y-6">
            {/* Anstehende Aufgaben */}
            <section className="rounded-lg border border-border bg-card">
              <div className="flex items-center justify-between border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Meine Aufgaben</h2>
                {metrics && metrics.activities_overdue > 0 && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-medium text-destructive">
                    {num(metrics.activities_overdue)} überfällig
                  </span>
                )}
              </div>
              {activities.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Nichts offen. <CheckSquare className="ml-1 inline h-3.5 w-3.5" />
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {activities.map((activity) => {
                    const overdue = activity.due_at && new Date(activity.due_at) < new Date();
                    return (
                      <li key={activity.id} className="flex items-start gap-2.5 px-4 py-2.5">
                        <Checkbox
                          checked={activity.done}
                          onCheckedChange={(checked) =>
                            toggle.mutate({ id: activity.id, done: checked === true })
                          }
                          className="mt-0.5"
                          aria-label="Als erledigt markieren"
                        />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-sm font-medium">{activity.subject}</div>
                          <div
                            className={cn(
                              'text-xs text-muted-foreground',
                              overdue && 'font-medium text-destructive',
                            )}
                          >
                            {dateRelative(activity.due_at)}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <div className="border-t border-border px-4 py-2">
                <Button variant="link" size="sm" className="h-auto p-0" asChild>
                  <Link to="/aufgaben">Alle Aufgaben</Link>
                </Button>
              </div>
            </section>

            {/* Letzte Abschlüsse */}
            <section className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Zuletzt gewonnen</h2>
              </div>
              {wins.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Noch keine gewonnenen Deals.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {wins.map((win) => (
                    <li key={win.id}>
                      <Link
                        to={`/deals/${win.id}`}
                        className="flex items-center justify-between gap-2 px-4 py-2.5 hover:bg-surface-hover"
                      >
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{win.title}</span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {win.companies?.name ?? dateShort(win.won_at)}
                          </span>
                        </span>
                        <span className="shrink-0 text-sm font-medium tabular-nums text-success">
                          {money(win.value)}
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          </div>
        </div>
      </div>
    </>
  );
}
