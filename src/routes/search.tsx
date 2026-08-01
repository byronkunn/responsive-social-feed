import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Search, X } from "lucide-react";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { PostCard } from "@/components/pulse/post-card";
import { Avatar } from "@/components/pulse/avatar";
import { Button } from "@/components/ui/button";
import { type Connection, type Post, trends as seedTrends } from "@/lib/pulse-data";
import { fetchPosts, fetchSuggestedProfiles, toggleFollowProfile } from "@/lib/social-api";
import { toast } from "sonner";

type SearchParams = { q: string };

export const Route = createFileRoute("/search")({
  validateSearch: (search: Record<string, unknown>): SearchParams => ({
    q: typeof search["q"] === "string" ? (search["q"] as string).slice(0, 100) : "",
  }),
  head: () => ({
    meta: [
      { title: "Search Pulse — find people, posts and tags" },
      {
        name: "description",
        content: "Search across every pulse, person and hashtag on the network.",
      },
      { property: "og:title", content: "Search Pulse — find people, posts and tags" },
      {
        property: "og:description",
        content: "Search across every pulse, person and hashtag on the network.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SearchPage,
});

const tabs = ["Top", "Latest", "People"] as const;
const defaultSearchTerms = ["building", "notes", "design", "typography", "weather", "localfirst"];

function SearchPage() {
  const { q } = Route.useSearch();
  const navigate = useNavigate({ from: "/search" });
  const [value, setValue] = useState(q);
  const [tab, setTab] = useState<(typeof tabs)[number]>("Top");
  const [allPosts, setAllPosts] = useState<Post[]>([]);
  const [people, setPeople] = useState<Connection[]>([]);

  useEffect(() => {
    fetchPosts()
      .then((data) => setAllPosts(data))
      .catch(() => undefined);
  }, []);

  useEffect(() => {
    let active = true;
    fetchSuggestedProfiles(q, 20)
      .then((profiles) => {
        if (active) setPeople(profiles);
      })
      .catch(() => {
        if (active) setPeople([]);
      });

    return () => {
      active = false;
    };
  }, [q]);

  const term = q.trim().toLowerCase();
  const results = term
    ? allPosts.filter(
        (p) =>
          p.body.toLowerCase().includes(term) ||
          p.author.name.toLowerCase().includes(term) ||
          p.author.handle.toLowerCase().includes(term),
      )
    : [];

  const searchSuggestions =
    seedTrends.length > 0 ? seedTrends.map((t) => t.title) : defaultSearchTerms.map((t) => `#${t}`);

  return (
    <AppShell>
      <TopBar title="Search" subtitle={q ? `Results for "${q}"` : "Find anything on Pulse"} />

      <div className="border-b border-border px-4 py-3 sm:px-6">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            navigate({ search: { q: value.trim() } });
          }}
          className="flex items-center gap-2 rounded-full bg-surface px-4 py-2.5"
        >
          <Search className="size-4 shrink-0 text-muted-foreground" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Search Pulse"
            aria-label="Search Pulse"
            className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
          />
          {value && (
            <button
              type="button"
              aria-label="Clear search"
              onClick={() => {
                setValue("");
                navigate({ search: { q: "" } });
              }}
              className="shrink-0 text-muted-foreground hover:text-foreground"
            >
              <X className="size-4" />
            </button>
          )}
        </form>
      </div>

      <div className="flex border-b border-border">
        {tabs.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 px-3 py-3 font-display text-sm font-bold transition-colors ${
              tab === t
                ? "border-b-2 border-signal text-foreground"
                : "text-muted-foreground hover:bg-surface"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {!q ? (
        <section className="p-4 sm:p-6">
          <h2 className="font-display text-lg font-bold">Try one of these</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {searchSuggestions.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => {
                  setValue(t);
                  navigate({ search: { q: t } });
                }}
                className="rounded-full bg-surface px-4 py-2 text-sm font-medium transition-colors hover:bg-surface-2"
              >
                {t}
              </button>
            ))}
          </div>
        </section>
      ) : tab === "People" ? (
        <ul className="divide-y divide-border">
          {people.map((p) => (
            <PeopleResult key={p.handle} person={p} />
          ))}
          {people.length === 0 && (
            <li className="px-6 py-10 text-center text-sm text-muted-foreground">
              No people matched "{q}".
            </li>
          )}
        </ul>
      ) : results.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">
          Nothing matched "{q}". Try a broader word.
        </p>
      ) : (
        (tab === "Latest" ? [...results].reverse() : results).map((post) => (
          <PostCard key={post.id} post={post} />
        ))
      )}
    </AppShell>
  );
}

function PeopleResult({ person }: { person: Connection }) {
  const [following, setFollowing] = useState(Boolean(person.follows));

  async function toggle() {
    const previous = following;
    setFollowing(!previous);
    try {
      await toggleFollowProfile(person.handle, previous);
      toast.success(previous ? `Unfollowed @${person.handle}` : `Following @${person.handle}`);
    } catch (error) {
      setFollowing(previous);
      toast.error(error instanceof Error ? error.message : "Follow update failed");
    }
  }

  return (
    <li className="flex items-center gap-3 px-4 py-4 sm:px-6">
      <Avatar initials={person.initials} className="size-10" />
      <div className="min-w-0 flex-1">
        <p className="truncate font-display text-sm font-bold">{person.name}</p>
        <p className="truncate text-xs text-muted-foreground">@{person.handle}</p>
      </div>
      <Button
        variant={following ? "default" : "secondary"}
        size="sm"
        onClick={() => void toggle()}
        className="shrink-0 rounded-full font-semibold"
      >
        {following ? "Following" : "Follow"}
      </Button>
    </li>
  );
}
