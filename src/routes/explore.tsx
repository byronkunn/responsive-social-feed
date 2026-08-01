import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Hash, Plus, Search, TrendingUp, X } from "lucide-react";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { PostCard } from "@/components/pulse/post-card";
import { useFollowedTags } from "@/hooks/use-preferences";
import { type Post, trends as seedTrends } from "@/lib/pulse-data";
import { fetchPosts } from "@/lib/social-api";

const suggestedTags = ["building", "weather", "notes", "design", "typography", "localfirst"];

export const Route = createFileRoute("/explore")({
  head: () => ({
    meta: [
      { title: "Explore trending topics — Pulse" },
      {
        name: "description",
        content: "See which conversations, tags and ideas are moving across Pulse right now.",
      },
      { property: "og:title", content: "Explore trending topics — Pulse" },
      {
        property: "og:description",
        content: "See which conversations, tags and ideas are moving across Pulse right now.",
      },
    ],
  }),
  component: Explore,
});

function Explore() {
  const navigate = useNavigate();
  const [q, setQ] = useState("");
  const [explorePosts, setExplorePosts] = useState<Post[]>([]);
  const { tags, isFollowing, toggleTag } = useFollowedTags();

  useEffect(() => {
    fetchPosts()
      .then((data) => setExplorePosts(data))
      .catch(() => undefined);
  }, []);

  const activeTrends =
    seedTrends.length > 0
      ? seedTrends
      : suggestedTags.map((t) => ({
          topic: "Topic",
          title: `#${t}`,
          count: "Explore community thoughts",
        }));

  return (
    <AppShell>
      <TopBar title="Explore" subtitle="What the network is chewing on" />

      <div className="border-b border-border px-4 py-3 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ to: "/search", search: { q: q.trim() } });
          }}
          className="flex items-center gap-3 rounded-full bg-surface px-4 py-2.5"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search Pulse"
            aria-label="Search Pulse"
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
        </form>
      </div>

      <section className="border-b border-border px-4 py-4 sm:px-6">
        <h2 className="font-display text-sm font-bold">Tags you follow</h2>
        {tags.length === 0 ? (
          <p className="mt-1 text-xs text-muted-foreground">
            Follow a tag to pin it here and see it in your feed.
          </p>
        ) : (
          <ul className="mt-3 flex flex-wrap gap-2">
            {tags.map((t) => (
              <li
                key={t}
                className="flex min-w-0 items-center gap-1 rounded-full bg-surface-2 pl-3 pr-1"
              >
                <Link
                  to="/tag/$tag"
                  params={{ tag: t }}
                  className="min-w-0 truncate py-1.5 font-display text-sm font-semibold hover:underline"
                >
                  #{t}
                </Link>
                <button
                  type="button"
                  onClick={() => toggleTag(t)}
                  aria-label={`Unfollow ${t}`}
                  className="grid size-6 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
                >
                  <X className="size-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}

        <h3 className="mt-5 font-display text-xs font-bold uppercase tracking-wide text-muted-foreground">
          Suggested tags
        </h3>
        <ul className="mt-2 flex flex-wrap gap-2">
          {suggestedTags.map((t) => {
            const on = isFollowing(t);
            return (
              <li key={t}>
                <button
                  type="button"
                  onClick={() => toggleTag(t)}
                  aria-pressed={on}
                  className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold transition-colors ${
                    on
                      ? "bg-primary text-primary-foreground"
                      : "bg-surface text-muted-foreground hover:bg-surface-2 hover:text-foreground"
                  }`}
                >
                  {on ? <Hash className="size-3.5" /> : <Plus className="size-3.5" />}
                  {t}
                </button>
              </li>
            );
          })}
        </ul>
      </section>

      <section className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 sm:p-6">
        {activeTrends.map((t) => (
          <Link
            key={t.title}
            to="/search"
            search={{ q: t.title }}
            className="block min-w-0 rounded-2xl bg-surface p-4 transition-colors hover:bg-surface-2"
          >
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <TrendingUp className="size-3.5 shrink-0 text-signal" />
              <span className="truncate">{t.topic}</span>
            </div>
            <h2 className="mt-1 truncate font-display text-base font-bold">{t.title}</h2>
            <p className="text-xs text-muted-foreground">{t.count}</p>
          </Link>
        ))}
      </section>

      <h2 className="px-4 py-4 font-display text-lg font-bold sm:px-6">Popular right now</h2>
      {explorePosts.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">
          No popular pulses right now. Start posting to fill the explore feed!
        </p>
      ) : (
        explorePosts.map((post) => <PostCard key={post.id} post={post} />)
      )}
    </AppShell>
  );
}
