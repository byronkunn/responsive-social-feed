import { useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { BadgeCheck, PenSquare, Search } from "lucide-react";
import { Avatar } from "@/components/pulse/avatar";
import { conversations, type Conversation } from "@/lib/pulse-data";
import { cn } from "@/lib/utils";

const filters = ["All", "Unread"] as const;
type Filter = (typeof filters)[number];

export function isOnline(c: Conversation) {
  return c.id.length % 2 === 0;
}

export function ConversationList({
  activeId,
  compact = false,
}: {
  activeId?: string;
  compact?: boolean;
}) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("All");

  const results = useMemo(() => {
    const term = q.trim().toLowerCase();
    return conversations.filter((c) => {
      if (filter === "Unread" && !c.unread) return false;
      if (!term) return true;
      return (
        c.person.name.toLowerCase().includes(term) ||
        c.person.handle.toLowerCase().includes(term) ||
        c.preview.toLowerCase().includes(term)
      );
    });
  }, [q, filter]);

  return (
    <div className="flex min-w-0 flex-col">
      <div className="border-b border-border px-3 py-3 sm:px-4">
        <div className="flex items-center gap-2.5 rounded-full bg-surface px-3.5 py-2">
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search conversations"
            aria-label="Search conversations"
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </div>
        <div className="mt-2.5 flex gap-1.5">
          {filters.map((f) => (
            <button
              key={f}
              type="button"
              onClick={() => setFilter(f)}
              aria-pressed={filter === f}
              className={cn(
                "rounded-full px-3 py-1 text-xs font-semibold transition-colors",
                filter === f
                  ? "bg-surface-2 text-foreground"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground",
              )}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {results.length === 0 ? (
        <div className="px-4 py-16 text-center text-sm text-muted-foreground">
          <p className="font-display font-bold text-foreground">No conversations yet</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Tap the new message icon below to start a private thread.
          </p>
        </div>
      ) : (
        <ul>
          {results.map((c) => (
            <li key={c.id}>
              <Link
                to="/messages/$conversationId"
                params={{ conversationId: c.id }}
                className={cn(
                  "grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-b border-border transition-colors hover:bg-surface/60",
                  compact ? "px-3 py-3" : "px-4 py-4 sm:px-6",
                  activeId === c.id && "bg-surface-2/70",
                )}
              >
                <div className="relative shrink-0">
                  <Avatar
                    initials={c.person.initials}
                    className={compact ? "size-10" : "size-11"}
                  />
                  {isOnline(c) && (
                    <span
                      aria-hidden
                      className="absolute -bottom-0.5 -right-0.5 size-3 rounded-full border-2 border-background bg-signal"
                    />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="flex min-w-0 items-center gap-1.5 truncate font-display text-sm font-bold">
                    <span className="truncate">{c.person.name}</span>
                    {c.person.verified && <BadgeCheck className="size-4 shrink-0 text-signal" />}
                  </p>
                  <p
                    className={cn(
                      "truncate text-sm",
                      c.unread ? "font-medium text-foreground/90" : "text-muted-foreground",
                    )}
                  >
                    {c.preview}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <span className="text-xs text-muted-foreground">{c.time}</span>
                  {c.unread ? (
                    <span className="grid min-w-5 place-items-center rounded-full bg-signal px-1.5 text-[10px] font-bold text-background">
                      {c.unread}
                    </span>
                  ) : null}
                </div>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function NewMessageButton({ className }: { className?: string }) {
  return (
    <Link
      to="/messages/$conversationId"
      params={{ conversationId: "new" }}
      aria-label="New message"
      className={cn(
        "fixed bottom-20 right-5 grid size-14 place-items-center rounded-full bg-primary text-primary-foreground shadow-lift transition-transform hover:scale-105 md:bottom-8",
        className,
      )}
    >
      <PenSquare className="size-5" />
    </Link>
  );
}
