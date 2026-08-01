import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Plus, Sparkles, Users } from "lucide-react";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { PostCard } from "@/components/pulse/post-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  communities as seedCommunities,
  posts as seedPosts,
  type Community,
  type Post,
} from "@/lib/pulse-data";
import {
  createCommunity,
  fetchCommunities,
  fetchPosts,
  toggleCommunityMembership,
} from "@/lib/social-api";
import { toast } from "sonner";

const LOCAL_COMMUNITIES_KEY = "pulse.local-communities";

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
  const [communities, setCommunities] = useState<Community[]>(
    import.meta.env.DEV ? readLocalCommunities() : [],
  );
  const [recentPosts, setRecentPosts] = useState<Post[]>(import.meta.env.DEV ? seedPosts : []);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    let active = true;
    fetchCommunities()
      .then((items) => {
        if (!active) return;
        setCommunities(
          items.length > 0 ? items : import.meta.env.DEV ? readLocalCommunities() : [],
        );
      })
      .catch(() => {
        if (active) setCommunities(import.meta.env.DEV ? readLocalCommunities() : []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    fetchPosts()
      .then((items) => {
        if (active) setRecentPosts(items.length > 0 ? items : import.meta.env.DEV ? seedPosts : []);
      })
      .catch(() => {
        if (active) setRecentPosts(import.meta.env.DEV ? seedPosts : []);
      });

    return () => {
      active = false;
    };
  }, []);

  async function handleCreateCommunity(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    try {
      await createCommunity(name, description);
      const items = await fetchCommunities();
      setCommunities(items);
      toast.success(`Community "${name.trim()}" created`);
    } catch (error) {
      if (!import.meta.env.DEV) {
        toast.error(error instanceof Error ? error.message : "Community could not be created");
        return;
      }
      const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
      setCommunities((current) => {
        const next = [
          {
            slug,
            name: name.trim(),
            blurb: description.trim() || "A shared room for related posts and people.",
            members: "1",
            activity: "now",
            joined: true,
          },
          ...current,
        ];
        writeLocalCommunities(next);
        return next;
      });
      toast.success("Community created locally");
    }

    setName("");
    setDescription("");
    setOpen(false);
  }

  async function toggleJoin(community: Community) {
    const previous = Boolean(community.joined);
    setCommunities((current) => {
      const next = current.map((item) =>
        item.slug === community.slug ? { ...item, joined: !previous } : item,
      );
      if (import.meta.env.DEV) writeLocalCommunities(next);
      return next;
    });

    try {
      await toggleCommunityMembership(community.slug, previous);
      toast.success(previous ? `Left ${community.name}` : `Joined ${community.name}`);
    } catch (error) {
      if (import.meta.env.DEV) {
        toast.success(
          previous ? `Left ${community.name} locally` : `Joined ${community.name} locally`,
        );
        return;
      }
      setCommunities((current) =>
        current.map((item) =>
          item.slug === community.slug ? { ...item, joined: previous } : item,
        ),
      );
      toast.error(error instanceof Error ? error.message : "Community update failed");
    }
  }

  return (
    <AppShell>
      <TopBar title="Communities" subtitle="Rooms with a shared obsession" />

      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
        <p className="min-w-0 text-sm text-muted-foreground">
          Join or create topic rooms that group people around shared interests.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0 rounded-full font-display font-bold">
              <Plus className="size-4" />
              <span className="hidden sm:inline">New community</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Create a community</DialogTitle>
              <DialogDescription>
                Start a topic room people can join from the communities page.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateCommunity} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="community-name">Name</Label>
                <Input
                  id="community-name"
                  placeholder="e.g. Local-first apps"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="community-description">Description</Label>
                <Input
                  id="community-description"
                  placeholder="What should people post here?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" className="w-full rounded-full font-display font-bold">
                  Create community
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <section className="grid gap-3 border-b border-border p-4 sm:grid-cols-2 sm:p-6">
        {loading ? (
          Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-36 animate-pulse rounded-2xl bg-surface" />
          ))
        ) : communities.length === 0 ? (
          <p className="sm:col-span-2 text-sm text-muted-foreground">
            No communities yet. Create the first topic room.
          </p>
        ) : (
          communities.map((c) => {
            const isJoined = Boolean(c.joined);
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
                  onClick={() => void toggleJoin(c)}
                  className="mt-4 self-start rounded-full font-semibold"
                >
                  {isJoined ? "Joined" : "Join"}
                </Button>
              </article>
            );
          })
        )}
      </section>

      <h2 className="flex items-center gap-2 px-4 py-4 font-display text-lg font-bold sm:px-6">
        <Sparkles className="size-4 text-signal" /> Recent public pulses
      </h2>
      {recentPosts.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">
          No public pulses yet.
        </p>
      ) : (
        recentPosts.slice(0, 3).map((post) => <PostCard key={post.id} post={post} />)
      )}

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

function readLocalCommunities() {
  try {
    const raw = localStorage.getItem(LOCAL_COMMUNITIES_KEY);
    const stored = raw ? (JSON.parse(raw) as Community[]) : [];
    return stored.length > 0 ? stored : seedCommunities;
  } catch {
    return seedCommunities;
  }
}

function writeLocalCommunities(communities: Community[]) {
  try {
    localStorage.setItem(LOCAL_COMMUNITIES_KEY, JSON.stringify(communities));
  } catch {
    // Local storage may be disabled.
  }
}
