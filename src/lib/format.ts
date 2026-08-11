import { format, formatDistanceToNowStrict, isThisYear, isToday, isTomorrow, isYesterday } from 'date-fns';
import { de } from 'date-fns/locale';

const eur = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  maximumFractionDigits: 0,
});

const eurExact = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
});

const decimal = new Intl.NumberFormat('de-DE');

/** Beträge in Listen und Kacheln — ohne Nachkommastellen, das Rauschen spart Platz. */
export function money(value: number | null | undefined): string {
  return eur.format(value ?? 0);
}

/** Beträge dort, wo der Cent zählt (Detailansicht, Formulare). */
export function moneyExact(value: number | null | undefined): string {
  return eurExact.format(value ?? 0);
}

export function num(value: number | null | undefined): string {
  return decimal.format(value ?? 0);
}

export function percent(value: number | null | undefined): string {
  return `${Math.round(value ?? 0)} %`;
}

/**
 * Wachstum gegenüber dem Vorzeitraum. Gibt null zurück, wenn der Vergleich
 * keine Aussage hat (Vorzeitraum bei null) — dann zeigt die UI gar nichts
 * statt eines irreführenden "+100 %".
 */
export function growth(current: number, previous: number): number | null {
  if (!previous) return null;
  return ((current - previous) / previous) * 100;
}

export function dateShort(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return format(d, isThisYear(d) ? 'd. MMM' : 'd. MMM yyyy', { locale: de });
}

export function dateLong(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return format(d, 'd. MMMM yyyy', { locale: de });
}

export function dateTime(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return format(d, "d. MMM yyyy, HH:mm 'Uhr'", { locale: de });
}

export function time(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return format(d, 'HH:mm', { locale: de });
}

/** „Heute, 14:30" / „Gestern" / „12. Mär" — für Zeitleisten und Posteingang. */
export function dateRelative(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (isToday(d)) return `Heute, ${format(d, 'HH:mm')}`;
  if (isYesterday(d)) return `Gestern, ${format(d, 'HH:mm')}`;
  if (isTomorrow(d)) return `Morgen, ${format(d, 'HH:mm')}`;
  return dateShort(d);
}

/** „vor 3 Tagen" — für Aktivitätsangaben ohne exakten Zeitbezug. */
export function ago(value: string | Date | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return `vor ${formatDistanceToNowStrict(d, { locale: de })}`;
}

export function initials(...parts: (string | null | undefined)[]): string {
  const letters = parts
    .filter(Boolean)
    .flatMap((p) => p!.trim().split(/\s+/))
    .map((w) => w[0])
    .filter(Boolean);
  return (letters[0] ?? '?').toUpperCase() + (letters.length > 1 ? letters[letters.length - 1].toUpperCase() : '');
}

export function displayName(c: { first_name?: string | null; last_name?: string | null; full_name?: string }): string {
  return c.full_name?.trim() || [c.first_name, c.last_name].filter(Boolean).join(' ') || 'Ohne Namen';
}

/**
 * Deterministische Avatar-Farbe aus einer ID. Bewusst nur Pastelltöne aus
 * einer festen Liste, damit die Oberfläche nicht bunt wird.
 */
const AVATAR_TONES = [
  'bg-blue-100 text-blue-700',
  'bg-emerald-100 text-emerald-700',
  'bg-amber-100 text-amber-700',
  'bg-violet-100 text-violet-700',
  'bg-rose-100 text-rose-700',
  'bg-cyan-100 text-cyan-700',
  'bg-indigo-100 text-indigo-700',
  'bg-teal-100 text-teal-700',
];

export function avatarTone(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  return AVATAR_TONES[Math.abs(hash) % AVATAR_TONES.length];
}

/** Domain aus einer Website-Angabe ziehen; toleriert fehlendes Protokoll. */
export function toDomain(website: string | null | undefined): string | null {
  if (!website) return null;
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`);
    return url.hostname.replace(/^www\./, '');
  } catch {
    return null;
  }
}
