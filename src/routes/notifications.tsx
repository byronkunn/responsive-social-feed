import { useEffect, useState, type ElementType } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Heart, Repeat2, UserPlus, AtSign, MessageCircle } from "lucide-react";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { requireClientSession } from "@/lib/require-auth";
import { fetchNotifications, markNotificationRead, type PulseNotification } from "@/lib/social-api";

type Kind = PulseNotification["kind"];

const iconByKind: Record<Kind, ElementType> = {
  spark: Heart,
  echo: Repeat2,
  follow: UserPlus,
  mention: AtSign,
  reply: MessageCircle,
  message: MessageCircle,
  system: AtSign,
};

const filters = [
  { key: "all", label: "All" },
  { key: "mention", label: "Mentions" },
  { key: "spark", label: "Sparks" },
  { key: "follow", label: "Follows" },
  { key: "message", label: "Messages" },
] as const;

export const Route = createFileRoute("/notifications")({
  beforeLoad: requireClientSession,
  head: () => ({
    meta: [
      { title: "Notifications — Pulse" },
      {
        name: "description",
        content: "Sparks, echoes, mentions and new followers from across your Pulse network.",
      },
      { property: "og:title", content: "Notifications — Pulse" },
      {
        property: "og:description",
        content: "Sparks, echoes, mentions and new followers from across your Pulse network.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Notifications,
});

function Notifications() {
  const [filter, setFilter] = useState<(typeof filters)[number]["key"]>("all");
  const [items, setItems] = useState<PulseNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const shown = filter === "all" ? items : items.filter((n) => n.kind === filter);

  useEffect(() => {
    let active = true;
    fetchNotifications()
      .then((notifications) => {
        if (!active) return;
        setItems(notifications);
      })
      .catch(() => {
        if (!active) return;
        setItems([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  async function markRead(notification: PulseNotification) {
    if (notification.read) return;
    setItems((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, read: true } : item)),
    );
    markNotificationRead(notification.id).catch(() => undefined);
  }

  return (
    <AppShell>
      <TopBar title="Notifications" />
      <div className="sticky top-[57px] z-20 grid grid-cols-5 border-b border-border bg-background/85 backdrop-blur">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
            aria-pressed={filter === f.key}
            className={`truncate py-3.5 text-center font-display text-sm font-bold transition-colors ${
              filter === f.key
                ? "border-b-2 border-signal text-foreground"
                : "text-muted-foreground hover:bg-surface/60"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="px-6 py-16 text-center text-sm text-muted-foreground">
          Loading notifications...
        </p>
      ) : shown.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-muted-foreground">
          No notifications yet.
        </p>
      ) : (
        <ul>
          {shown.map((n) => {
            const Icon = iconByKind[n.kind] ?? AtSign;
            const content = (
              <>
                <Icon className="mt-0.5 size-5 shrink-0 text-signal" />
                <p className="min-w-0 text-sm leading-relaxed text-foreground/90">{n.text}</p>
                <span className="shrink-0 text-xs text-muted-foreground">{n.time}</span>
              </>
            );
            const className = `grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-border px-4 py-4 transition-colors hover:bg-surface/60 sm:px-6 ${
              n.read ? "" : "bg-surface/35"
            }`;

            return (
              <li key={n.id}>
                {n.href ? (
                  <Link to={n.href} onClick={() => void markRead(n)} className={className}>
                    {content}
                  </Link>
                ) : (
                  <button
                    type="button"
                    onClick={() => void markRead(n)}
                    className={`${className} w-full text-left`}
                  >
                    {content}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </AppShell>
  );
}
