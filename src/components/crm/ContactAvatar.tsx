import { cn } from "@/lib/utils";

export function ContactAvatar({ firstName, lastName, className }: { firstName: string; lastName: string; className?: string }) {
  const initials = `${firstName[0] || ""}${lastName[0] || ""}`.toUpperCase();
  return (
    <div className={cn("w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center text-xs font-medium text-primary", className)}>
      {initials}
    </div>
  );
}
