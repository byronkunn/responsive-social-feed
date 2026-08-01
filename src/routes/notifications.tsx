import { useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { Heart, Repeat2, UserPlus, AtSign, MessageCircle } from "lucide-react";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { requireClientSession } from "@/lib/require-auth";

type Kind = "spark" | "echo" | "follow" | "mention" | "reply";

const items: { kind: Kind; icon: React.ElementType; text: string; time: string }[] = [
  {
    kind: "spark",
    icon: Heart,
    text: "Mira Kade and 42 others sparked your pulse about slow tooling.",
    time: "8m",
  },
  { kind: "echo", icon: Repeat2, text: "Otis Vane echoed your pulse.", time: "26m" },
  { kind: "follow", icon: UserPlus, text: "Rae Osei started following you.", time: "1h" },
  {
    kind: "mention",
    icon: AtSign,
    text: "Field Notes mentioned you in a thread about coastline data.",
    time: "4h",
  },
  {
    kind: "reply",
    icon: MessageCircle,
    text: "Coop replied: “my starter agrees with this take”.",
    time: "6h",
  },
  { kind: "spark", icon: Heart, text: "Coop sparked your reply.", time: "yesterday" },
  { kind: "follow", icon: UserPlus, text: "Halden Type started following you.", time: "yesterday" },
  {
    kind: "mention",
    icon: AtSign,
    text: "The Quiet Lab mentioned you in “small tools, big Tuesdays”.",
    time: "2d",
  },
];

const filters = [
  { key: "all", label: "All" },
  { key: "mention", label: "Mentions" },
  { key: "spark", label: "Sparks" },
  { key: "follow", label: "Follows" },
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
  const shown = filter === "all" ? items : items.filter((n) => n.kind === filter);

  return (
    <AppShell>
      <TopBar title="Notifications" />
      <div className="sticky top-[57px] z-20 grid grid-cols-4 border-b border-border bg-background/85 backdrop-blur">
        {filters.map((f) => (
          <button
            key={f.key}
            type="button"
            onClick={() => setFilter(f.key)}
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

      {shown.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-muted-foreground">
          Nothing here yet. Quiet is nice sometimes.
        </p>
      ) : (
        <ul>
          {shown.map((n, i) => (
            <li
              key={i}
              className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-border px-4 py-4 transition-colors hover:bg-surface/60 sm:px-6"
            >
              <n.icon className="mt-0.5 size-5 shrink-0 text-signal" />
              <p className="min-w-0 text-sm leading-relaxed text-foreground/90">{n.text}</p>
              <span className="shrink-0 text-xs text-muted-foreground">{n.time}</span>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
