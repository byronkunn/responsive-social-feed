import { useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { Hash, Plus, Search, TrendingUp, X } from "lucide-react";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { PostCard } from "@/components/pulse/post-card";
import { useFollowedTags } from "@/hooks/use-preferences";
import { type Post } from "@/lib/pulse-data";
import { fetchExploreData, type ExploreTrend } from "@/lib/social-api";

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
  const [trends, setTrends] = useState<ExploreTrend[]>([]);
  const [availableTags, setAvailableTags] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const { tags, isFollowing, toggleTag } = useFollowedTags();
  const submitSearch = () => {
    if (q.trim()) navigate({ to: "/search", search: { q: q.trim() } });
  };

  useEffect(() => {
    let active = true;

    fetchExploreData()
      .then((data) => {
        if (!active) return;
        setExplorePosts(data.posts);
        setTrends(data.trends);
        setAvailableTags(data.suggestedTags);
        setLoadError(false);
      })
      .catch(() => {
        if (!active) return;
        setExplorePosts([]);
        setTrends([]);
        setAvailableTags([]);
        setLoadError(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const term = q.trim().toLowerCase();
  const filteredPosts = term
    ? explorePosts.filter(
        (post) =>
          post.body.toLowerCase().includes(term) ||
          post.author.name.toLowerCase().includes(term) ||
          post.author.handle.toLowerCase().includes(term) ||
          (post.tag ?? "").toLowerCase().includes(term),
      )
    : explorePosts;

  return (
    <AppShell>
      <TopBar
        title="Explore"
        subtitle={
          loading
            ? "Finding active conversations"
            : `${explorePosts.length} popular pulse${explorePosts.length === 1 ? "" : "s"}`
        }
      />

      <div className="border-b border-border px-4 py-3 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submitSearch();
          }}
          className="flex items-center gap-3 rounded-full bg-surface px-4 py-2.5"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submitSearch();
              }
            }}
            placeholder="Search Pulse"
            aria-label="Search Pulse"
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          {q && (
            <button
              type="button"
              aria-label="Clear explore search"
              onClick={() => setQ("")}
              className="grid size-7 shrink-0 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
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
        {availableTags.length === 0 ? (
          <p className="mt-2 text-xs text-muted-foreground">
            Suggested tags appear from real hashtags in public posts.
          </p>
        ) : (
          <ul className="mt-2 flex flex-wrap gap-2">
            {availableTags.map((t) => {
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
        )}
      </section>

      <section className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 sm:p-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-[100px] animate-pulse rounded-2xl bg-surface" />
          ))
        ) : trends.length === 0 ? (
          <p className="sm:col-span-2 text-sm text-muted-foreground">
            Trends will appear after people post with hashtags.
          </p>
        ) : (
          trends.map((t) => (
            <Link
              key={t.title}
              to="/tag/$tag"
              params={{ tag: t.tag }}
              className="block min-w-0 rounded-2xl bg-surface p-4 transition-colors hover:bg-surface-2"
            >
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <TrendingUp className="size-3.5 shrink-0 text-signal" />
                <span className="truncate">{t.topic}</span>
              </div>
              <h2 className="mt-1 truncate font-display text-base font-bold">{t.title}</h2>
              <p className="text-xs text-muted-foreground">{t.count}</p>
            </Link>
          ))
        )}
      </section>

      <div className="flex items-center justify-between gap-3 px-4 py-4 sm:px-6">
        <div>
          <h2 className="font-display text-lg font-bold">
            {term ? `Explore results for "${q.trim()}"` : "Popular right now"}
          </h2>
          {loadError && (
            <p className="mt-1 text-xs text-muted-foreground">
              Live Supabase posts are unavailable. Apply the project migrations to populate Explore.
            </p>
          )}
        </div>
        {term && (
          <button
            type="button"
            onClick={() => setQ("")}
            className="shrink-0 rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            Clear
          </button>
        )}
      </div>
      {loading ? (
        <div className="space-y-3 px-4 pb-6 sm:px-6">
          <div className="h-32 animate-pulse rounded-2xl bg-surface" />
          <div className="h-32 animate-pulse rounded-2xl bg-surface" />
        </div>
      ) : filteredPosts.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">
          {term
            ? `No pulses matched "${q.trim()}". Try a broader word or hashtag.`
            : "No popular pulses right now. Start posting with hashtags to fill Explore."}
        </p>
      ) : (
        filteredPosts.map((post) => <PostCard key={post.id} post={post} />)
      )}
    </AppShell>
  );
}
