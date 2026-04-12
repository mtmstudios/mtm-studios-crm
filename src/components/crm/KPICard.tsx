import { cn } from "@/lib/utils";
import { LucideIcon } from "lucide-react";

interface KPICardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  className?: string;
}

export function KPICard({ label, value, icon: Icon, className }: KPICardProps) {
  return (
    <div className={cn("bg-card rounded-lg border border-border p-5 animate-fade-in", className)}>
      <div className="flex items-center justify-between mb-3">
        <span className="text-secondary-foreground text-sm">{label}</span>
        <Icon className="h-4 w-4 text-muted-foreground" />
      </div>
      <p className="text-2xl font-bold text-primary">{value}</p>
    </div>
  );
}
