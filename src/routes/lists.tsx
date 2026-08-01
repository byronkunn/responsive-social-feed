import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { ListMusic, Lock, Plus } from "lucide-react";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { Avatar } from "@/components/pulse/avatar";
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
import { currentUser, lists as initialLists, type PulseList } from "@/lib/pulse-data";
import { toast } from "sonner";

import { createList, fetchLists } from "@/lib/social-api";

const LOCAL_LISTS_KEY = "pulse.local-lists";

export const Route = createFileRoute("/lists")({
  head: () => ({
    meta: [
      { title: "Lists — curated feeds on Pulse" },
      {
        name: "description",
        content: "Follow hand-curated lists of people and keep separate feeds for each interest.",
      },
      { property: "og:title", content: "Lists — curated feeds on Pulse" },
      {
        property: "og:description",
        content: "Follow hand-curated lists of people and keep separate feeds for each interest.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Lists,
});

function Lists() {
  const [allLists, setAllLists] = useState<PulseList[]>(() =>
    import.meta.env.DEV ? readLocalLists() : initialLists,
  );
  const [followed, setFollowed] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("pulse.followed-lists") || "[]") as string[];
    } catch {
      return [];
    }
  });
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isPrivate, setIsPrivate] = useState(false);

  useEffect(() => {
    let active = true;
    fetchLists()
      .then((lists) => {
        if (!active) return;
        setAllLists(lists.length > 0 ? lists : import.meta.env.DEV ? readLocalLists() : []);
      })
      .catch(() => {
        if (active) setAllLists(import.meta.env.DEV ? readLocalLists() : []);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("pulse.followed-lists", JSON.stringify(followed));
  }, [followed]);

  async function handleCreateList(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const newList: PulseList = {
      slug,
      name: name.trim(),
      description: description.trim() || "Custom curated feed",
      curator: currentUser,
      members: 1,
      posts: 0,
      pinned: isPrivate,
    };
    try {
      await createList(name, description, isPrivate);
      const lists = await fetchLists();
      setAllLists(lists.length > 0 ? lists : [newList, ...allLists]);
    } catch (error) {
      if (!import.meta.env.DEV) {
        toast.error(error instanceof Error ? error.message : "List could not be created");
        return;
      }
      setAllLists((prev) => {
        const next = [newList, ...prev];
        writeLocalLists(next);
        return next;
      });
    }
    setFollowed((prev) => [...prev, slug]);
    setName("");
    setDescription("");
    setIsPrivate(false);
    setOpen(false);
    toast.success(`List "${newList.name}" created`);
  }

  return (
    <AppShell>
      <TopBar title="Lists" subtitle="Feeds you build by hand" />

      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-4 sm:px-6">
        <p className="min-w-0 text-sm text-muted-foreground">
          Group people into focused feeds. No algorithm, just your picks.
        </p>
        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button size="sm" className="shrink-0 rounded-full font-display font-bold">
              <Plus className="size-4" />
              <span className="hidden sm:inline">New list</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="font-display">Create a new list</DialogTitle>
              <DialogDescription>
                Build a custom feed of people to follow without algorithms.
              </DialogDescription>
            </DialogHeader>
            <form onSubmit={handleCreateList} className="space-y-4 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="list-name">Name</Label>
                <Input
                  id="list-name"
                  placeholder="e.g. Design Systems"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="list-desc">Description</Label>
                <Input
                  id="list-desc"
                  placeholder="What is this list about?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="checkbox"
                  id="list-private"
                  checked={isPrivate}
                  onChange={(e) => setIsPrivate(e.target.checked)}
                  className="size-4 rounded border-border"
                />
                <Label htmlFor="list-private" className="text-sm font-normal">
                  Make private (only visible to you)
                </Label>
              </div>
              <DialogFooter className="mt-4">
                <Button type="submit" className="w-full rounded-full font-display font-bold">
                  Create list
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <ul className="divide-y divide-border">
        {loading ? (
          Array.from({ length: 3 }).map((_, index) => (
            <li key={index} className="px-4 py-4 sm:px-6">
              <div className="h-28 animate-pulse rounded-2xl bg-surface" />
            </li>
          ))
        ) : allLists.length === 0 ? (
          <li className="px-6 py-16 text-center text-sm text-muted-foreground">
            No lists yet. Create your first list to build a focused feed.
          </li>
        ) : (
          allLists.map((list) => {
            const isFollowed = followed.includes(list.slug);
            return (
              <li
                key={list.slug}
                className="px-4 py-4 transition-colors hover:bg-surface/60 sm:px-6"
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 sm:gap-4">
                  <div className="grid size-12 shrink-0 place-items-center rounded-2xl bg-surface-2 text-signal">
                    <ListMusic className="size-5" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <h2 className="truncate font-display text-base font-bold">{list.name}</h2>
                      {list.pinned && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-surface-2 px-2 py-0.5 text-[0.7rem] text-muted-foreground">
                          <Lock className="size-3" /> Private
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-sm leading-relaxed break-words text-muted-foreground">
                      {list.description}
                    </p>

                    <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
                      <span className="flex min-w-0 items-center gap-2 text-xs text-muted-foreground">
                        <Avatar initials={list.curator.initials} className="size-6 text-[0.6rem]" />
                        <span className="truncate">@{list.curator.handle}</span>
                      </span>
                      <span className="text-xs text-muted-foreground tabular-nums">
                        {list.members} members · {list.posts.toLocaleString()} posts
                      </span>
                      <Button
                        size="sm"
                        variant={isFollowed ? "secondary" : "default"}
                        onClick={() => {
                          setFollowed((prev) =>
                            prev.includes(list.slug)
                              ? prev.filter((s) => s !== list.slug)
                              : [...prev, list.slug],
                          );
                          toast.success(
                            isFollowed ? `Unfollowed ${list.name}` : `Following ${list.name}`,
                          );
                        }}
                        className="ml-auto shrink-0 rounded-full font-semibold"
                      >
                        {isFollowed ? "Following" : "Follow"}
                      </Button>
                    </div>
                  </div>
                </div>
              </li>
            );
          })
        )}
      </ul>

      <p className="px-4 py-6 text-sm text-muted-foreground sm:px-6">
        Looking for something broader?{" "}
        <Link to="/communities" className="font-semibold text-signal hover:underline">
          Browse communities
        </Link>
        .
      </p>
    </AppShell>
  );
}

function readLocalLists() {
  try {
    const raw = localStorage.getItem(LOCAL_LISTS_KEY);
    const stored = raw ? (JSON.parse(raw) as PulseList[]) : [];
    return stored.length > 0 ? stored : initialLists;
  } catch {
    return initialLists;
  }
}

function writeLocalLists(lists: PulseList[]) {
  try {
    localStorage.setItem(LOCAL_LISTS_KEY, JSON.stringify(lists));
  } catch {
    // Local storage may be disabled.
  }
}
