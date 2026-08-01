import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Users, Sparkles } from "lucide-react";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { PostCard } from "@/components/pulse/post-card";
import { Button } from "@/components/ui/button";
import { communities, posts } from "@/lib/pulse-data";

export const Route = createFileRoute("/communities")({
  head: () => ({
    meta: [
      { title: "Communities — shared spaces on Pulse" },
      {
        name: "description",
        content:
          "Join topic-based communities on Pulse and post to people who care about the same thing.",
      },
      { property: "og:title", content: "Communities — shared spaces on Pulse" },
      {
        property: "og:description",
        content:
          "Join topic-based communities on Pulse and post to people who care about the same thing.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Communities,
});

function Communities() {
  const [joined, setJoined] = useState<string[]>(
    communities.filter((c) => c.joined).map((c) => c.slug),
  );

  return (
    <AppShell>
      <TopBar title="Communities" subtitle="Rooms with a shared obsession" />

      <section className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 sm:p-6">
        {communities.map((c) => {
          const isJoined = joined.includes(c.slug);
          return (
            <article
              key={c.slug}
              className="flex min-w-0 flex-col rounded-2xl bg-surface p-4 transition-colors hover:bg-surface-2"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Users className="size-3.5 shrink-0 text-signal" />
                <span className="truncate">
                  {c.members} members · {c.activity}
                </span>
              </div>
              <h2 className="mt-1 truncate font-display text-base font-bold">{c.name}</h2>
              <p className="mt-1 flex-1 text-sm leading-relaxed break-words text-muted-foreground">
                {c.blurb}
              </p>
              <Button
                size="sm"
                variant={isJoined ? "secondary" : "default"}
                onClick={() =>
                  setJoined((prev) =>
                    prev.includes(c.slug) ? prev.filter((s) => s !== c.slug) : [...prev, c.slug],
                  )
                }
                className="mt-4 self-start rounded-full font-semibold"
              >
                {isJoined ? "Joined" : "Join"}
              </Button>
            </article>
          );
        })}
      </section>

      <h2 className="flex items-center gap-2 px-4 py-4 font-display text-lg font-bold sm:px-6">
        <Sparkles className="size-4 text-signal" /> From your communities
      </h2>
      {posts.slice(0, 3).map((post) => (
        <PostCard key={post.id} post={post} />
      ))}

      <p className="px-4 py-6 text-sm text-muted-foreground sm:px-6">
        Prefer something smaller?{" "}
        <Link to="/lists" className="font-semibold text-signal hover:underline">
          Build a list instead
        </Link>
        .
      </p>
    </AppShell>
  );
}
