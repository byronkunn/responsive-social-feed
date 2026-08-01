import { cn } from "@/lib/utils";

export function Avatar({ initials, className }: { initials: string; className?: string }) {
  return (
    <div
      aria-hidden
      className={cn(
        "grid size-10 shrink-0 place-items-center rounded-2xl bg-surface-2 font-display text-sm font-bold text-foreground ring-1 ring-border",
        className,
      )}
    >
      {initials}
    </div>
  );
}
