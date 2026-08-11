import { useMemo, useState } from 'react';
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { format } from 'date-fns';
import { de } from 'date-fns/locale';
import { money, num, percent } from '@/lib/format';
import { usePipelines, useProfiles } from '@/features/meta/api';
import {
  RANGE_LABEL,
  rangeBounds,
  useDashboardMetrics,
  usePipelineConversion,
  type Range,
} from '@/features/reports/api';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/crm/primitives';

/** Ein Farbton, Helligkeit trägt die Größe — kein Regenbogen über Kategorien. */
const HUE = 'hsl(221 83% 53%)';
const HUE_SOFT = 'hsl(221 83% 53% / 0.12)';
const GRID = 'hsl(240 6% 90%)';
const INK_MUTED = 'hsl(240 4% 46%)';

function ChartTooltip({
  active,
  payload,
  label,
  formatter,
}: {
  active?: boolean;
  payload?: { value: number; name: string }[];
  label?: string;
  formatter(value: number): string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border border-border bg-popover px-2.5 py-1.5 text-xs shadow-md">
      <div className="font-medium">{label}</div>
      <div className="mt-0.5 tabular-nums text-muted-foreground">{formatter(payload[0].value)}</div>
    </div>
  );
}

export default function Reports() {
  const [range, setRange] = useState<Range>('90t');
  const [scope, setScope] = useState<string>('team');

  const { data: profiles = [] } = useProfiles();
  const { data: pipelines = [] } = usePipelines();
  const pipelineId = pipelines.find((p) => p.is_default)?.id ?? pipelines[0]?.id;

  const ownerId = scope === 'team' ? null : scope;
  const { data: metrics, isPending } = useDashboardMetrics(range, ownerId);
  const { data: conversion = [] } = usePipelineConversion(pipelineId);

  const { from, to } = rangeBounds(range);

  /**
   * Die Datenbank liefert nur Tage mit Umsatz. Für eine ehrliche Zeitachse
   * müssen die Lücken mit 0 aufgefüllt werden — sonst suggeriert die Linie
   * einen gleichmäßigen Verlauf, den es nicht gab.
   */
  const series = useMemo(() => {
    const byDay = new Map((metrics?.won_series ?? []).map((p) => [p.day, Number(p.value)]));
    const out: { day: string; label: string; value: number }[] = [];
    const cursor = new Date(from);
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= to) {
      const key = format(cursor, 'yyyy-MM-dd');
      out.push({
        day: key,
        label: format(cursor, 'd. MMM', { locale: de }),
        value: byDay.get(key) ?? 0,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return out;
  }, [metrics?.won_series, from, to]);

  const funnel = conversion.map((row) => ({
    ...row,
    rate: row.reached > 0 ? (Number(row.won) / Number(row.reached)) * 100 : 0,
  }));
  const maxReached = Math.max(1, ...funnel.map((f) => Number(f.reached)));

  return (
    <>
      <PageHeader title="Berichte" subtitle={RANGE_LABEL[range]}>
        <Select value={scope} onValueChange={setScope}>
          <SelectTrigger className="h-9 w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="team">Ganzes Team</SelectItem>
            {profiles.map((p) => (
              <SelectItem key={p.id} value={p.id}>
                {p.full_name ?? p.email}
              </SelectItem>
            ))}
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
          <Skeleton className="h-72 w-full" />
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                { label: 'Umsatz gewonnen', value: money(metrics.won_value) },
                { label: 'Ø Dealgröße', value: money(metrics.avg_deal_size) },
                {
                  label: 'Ø Laufzeit',
                  value: `${Math.round(Number(metrics.avg_cycle_days))} Tage`,
                },
                { label: 'Neue Deals', value: num(metrics.created_count) },
              ].map((kpi) => (
                <div key={kpi.label} className="rounded-lg border border-border bg-card p-4">
                  <div className="text-sm text-muted-foreground">{kpi.label}</div>
                  <div className="mt-1.5 text-2xl font-semibold tabular-nums">{kpi.value}</div>
                </div>
              ))}
            </div>

            {/* Umsatzverlauf — eine Reihe, deshalb ohne Legende */}
            <section className="rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3">
                <h2 className="text-sm font-semibold">Gewonnener Umsatz</h2>
                <p className="text-xs text-muted-foreground">
                  Tageswerte im gewählten Zeitraum
                </p>
              </div>
              <div className="p-4">
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={series} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={{ fontSize: 11, fill: INK_MUTED }}
                      tickLine={false}
                      axisLine={{ stroke: GRID }}
                      minTickGap={40}
                    />
                    <YAxis
                      tick={{ fontSize: 11, fill: INK_MUTED }}
                      tickLine={false}
                      axisLine={false}
                      width={72}
                      tickFormatter={(v) => money(Number(v))}
                    />
                    <Tooltip
                      content={<ChartTooltip formatter={(v) => money(v)} />}
                      cursor={{ stroke: GRID }}
                    />
                    <Area
                      type="monotone"
                      dataKey="value"
                      stroke={HUE}
                      strokeWidth={2}
                      fill={HUE_SOFT}
                      dot={false}
                      activeDot={{ r: 4, strokeWidth: 2, stroke: 'white' }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </section>

            <div className="grid gap-6 lg:grid-cols-2">
              {/* Trichter: erreichte Deals je Phase */}
              <section className="rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">Phasen-Trichter</h2>
                  <p className="text-xs text-muted-foreground">
                    Wie viele Deals jede Phase je erreicht haben
                  </p>
                </div>
                <div className="p-4">
                  {funnel.length === 0 ? (
                    <p className="py-10 text-center text-sm text-muted-foreground">
                      Noch keine Daten.
                    </p>
                  ) : (
                    <ResponsiveContainer width="100%" height={240}>
                      <BarChart
                        data={funnel}
                        layout="vertical"
                        margin={{ top: 0, right: 16, bottom: 0, left: 0 }}
                      >
                        <CartesianGrid stroke={GRID} horizontal={false} />
                        <XAxis
                          type="number"
                          tick={{ fontSize: 11, fill: INK_MUTED }}
                          tickLine={false}
                          axisLine={{ stroke: GRID }}
                          allowDecimals={false}
                        />
                        <YAxis
                          type="category"
                          dataKey="stage_name"
                          tick={{ fontSize: 11, fill: INK_MUTED }}
                          tickLine={false}
                          axisLine={false}
                          width={110}
                        />
                        <Tooltip
                          content={<ChartTooltip formatter={(v) => `${num(v)} Deals`} />}
                          cursor={{ fill: 'hsl(240 5% 96%)' }}
                        />
                        <Bar dataKey="reached" radius={[0, 4, 4, 0]} barSize={18}>
                          {funnel.map((row) => (
                            // Helligkeit trägt die Menge, der Farbton bleibt gleich
                            <Cell
                              key={row.stage_id}
                              fill={`hsl(221 83% 53% / ${0.35 + (Number(row.reached) / maxReached) * 0.65})`}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
              </section>

              {/* Tabellensicht derselben Daten */}
              <section className="rounded-lg border border-border bg-card">
                <div className="border-b border-border px-4 py-3">
                  <h2 className="text-sm font-semibold">Abschlussquote je Phase</h2>
                  <p className="text-xs text-muted-foreground">
                    Anteil der Deals, die nach dieser Phase gewonnen wurden
                  </p>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-xs uppercase tracking-wide text-muted-foreground">
                      <th className="px-4 py-2 text-left font-medium">Phase</th>
                      <th className="px-4 py-2 text-right font-medium">Erreicht</th>
                      <th className="px-4 py-2 text-right font-medium">Gewonnen</th>
                      <th className="px-4 py-2 text-right font-medium">Quote</th>
                    </tr>
                  </thead>
                  <tbody>
                    {funnel.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="px-4 py-8 text-center text-muted-foreground">
                          Noch keine Daten.
                        </td>
                      </tr>
                    ) : (
                      funnel.map((row) => (
                        <tr key={row.stage_id} className="border-b border-border last:border-0">
                          <td className="px-4 py-2">{row.stage_name}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{num(row.reached)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{num(row.won)}</td>
                          <td className="px-4 py-2 text-right font-medium tabular-nums">
                            {percent(row.rate)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </section>
            </div>
          </>
        )}
      </div>
    </>
  );
}
