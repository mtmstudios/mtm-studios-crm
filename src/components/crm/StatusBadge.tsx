import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  lead: "bg-blue-500/20 text-blue-400",
  prospect: "bg-amber-500/20 text-amber-400",
  customer: "bg-emerald-500/20 text-emerald-400",
  inactive: "bg-zinc-500/20 text-zinc-400",
  qualified: "bg-violet-500/20 text-violet-400",
  proposal: "bg-orange-500/20 text-orange-400",
  negotiation: "bg-yellow-500/20 text-yellow-400",
  won: "bg-emerald-500/20 text-emerald-400",
  lost: "bg-red-500/20 text-red-400",
  new: "bg-primary/20 text-primary",
  contacted: "bg-blue-500/20 text-blue-400",
  converted: "bg-emerald-500/20 text-emerald-400",
  dismissed: "bg-zinc-500/20 text-zinc-400",
  manual: "bg-zinc-500/20 text-zinc-400",
  voice_ai: "bg-primary/20 text-primary",
  website: "bg-blue-500/20 text-blue-400",
  referral: "bg-violet-500/20 text-violet-400",
  information: "bg-blue-500/20 text-blue-400",
  appointment: "bg-emerald-500/20 text-emerald-400",
  callback: "bg-amber-500/20 text-amber-400",
  other: "bg-zinc-500/20 text-zinc-400",
  // Appointment statuses
  scheduled: "bg-blue-500/20 text-blue-400",
  confirmed: "bg-emerald-500/20 text-emerald-400",
  completed: "bg-emerald-500/20 text-emerald-400",
  cancelled: "bg-red-500/20 text-red-400",
  // Message statuses
  sent: "bg-blue-500/20 text-blue-400",
  delivered: "bg-emerald-500/20 text-emerald-400",
  read: "bg-emerald-500/20 text-emerald-400",
  failed: "bg-red-500/20 text-red-400",
  // Review request statuses
  pending: "bg-yellow-500/20 text-yellow-400",
  declined: "bg-red-500/20 text-red-400",
};

const labelMap: Record<string, string> = {
  lead: "Lead",
  prospect: "Interessent",
  customer: "Kunde",
  inactive: "Inaktiv",
  qualified: "Qualifiziert",
  proposal: "Angebot",
  negotiation: "Verhandlung",
  won: "Gewonnen",
  lost: "Verloren",
  new: "Neu",
  contacted: "Kontaktiert",
  converted: "Konvertiert",
  dismissed: "Abgelehnt",
  manual: "Manuell",
  voice_ai: "Voice AI",
  website: "Website",
  referral: "Empfehlung",
  information: "Information",
  appointment: "Termin",
  callback: "Rückruf",
  other: "Sonstiges",
  // Appointment statuses
  scheduled: "Geplant",
  confirmed: "Bestätigt",
  completed: "Abgeschlossen",
  cancelled: "Abgesagt",
  // Message statuses
  sent: "Gesendet",
  delivered: "Zugestellt",
  read: "Gelesen",
  failed: "Fehlgeschlagen",
  // Review request statuses
  pending: "Ausstehend",
  declined: "Abgelehnt",
};

export function StatusBadge({ status, className }: { status: string; className?: string }) {
  return (
    <span className={cn("inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-pill", statusColors[status] || "bg-zinc-500/20 text-zinc-400", className)}>
      {labelMap[status] || status}
    </span>
  );
}
