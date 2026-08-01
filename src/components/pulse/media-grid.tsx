import { useEffect, useRef, useState } from "react";
import { X, ChevronLeft, ChevronRight } from "lucide-react";
import type { MediaItem } from "@/lib/pulse-data";
import { cn } from "@/lib/utils";

export function MediaGrid({ items }: { items: MediaItem[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (open === null) return;
    const dialog = dialogRef.current;
    const focusable = () =>
      Array.from(
        dialog?.querySelectorAll<HTMLElement>("button, [href], [tabindex]:not([tabindex='-1'])") ??
          [],
      );
    focusable()[0]?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(null);
      if (event.key !== "Tab") return;
      const items = focusable();
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      returnFocusRef.current?.focus();
    };
  }, [open]);

  return (
    <>
      <div
        className={cn(
          "mt-3 grid gap-1.5 overflow-hidden rounded-2xl",
          items.length === 1 ? "grid-cols-1" : "grid-cols-2",
        )}
      >
        {items.map((m, i) => (
          <button
            key={m.id}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              returnFocusRef.current = e.currentTarget;
              setOpen(i);
            }}
            aria-label={`Open image: ${m.alt}`}
            className={cn(
              "group relative aspect-[16/10] w-full overflow-hidden rounded-xl bg-gradient-to-br ring-1 ring-border",
              m.hue,
              items.length === 3 && i === 0 && "col-span-2 aspect-[16/7]",
            )}
          >
            <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-background/80 to-transparent px-3 py-2 text-left text-[11px] text-foreground/80 opacity-0 transition-opacity group-hover:opacity-100">
              {m.alt}
            </span>
          </button>
        ))}
      </div>

      {open !== null && (
        <div
          role="dialog"
          ref={dialogRef}
          aria-modal="true"
          aria-label={items[open]?.alt}
          className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-4 backdrop-blur"
          onClick={() => setOpen(null)}
        >
          <button
            type="button"
            aria-label="Close"
            onClick={() => setOpen(null)}
            className="absolute right-4 top-4 grid size-10 place-items-center rounded-full bg-surface text-foreground"
          >
            <X className="size-5" />
          </button>

          <figure className="w-full max-w-3xl" onClick={(e) => e.stopPropagation()}>
            <div
              className={cn(
                "aspect-[16/10] w-full rounded-3xl bg-gradient-to-br ring-1 ring-border",
                items[open]?.hue,
              )}
            />
            <figcaption className="mt-3 text-center text-sm text-muted-foreground">
              {items[open]?.alt}
            </figcaption>
          </figure>

          {items.length > 1 && (
            <div className="absolute inset-x-0 bottom-8 flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((i) => ((i ?? 0) - 1 + items.length) % items.length);
                }}
                className="grid size-11 place-items-center rounded-full bg-surface"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="text-xs tabular-nums text-muted-foreground">
                {open + 1} / {items.length}
              </span>
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpen((i) => ((i ?? 0) + 1) % items.length);
                }}
                className="grid size-11 place-items-center rounded-full bg-surface"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
