import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { PostCard } from "@/components/pulse/post-card";
import { type Post } from "@/lib/pulse-data";
import { requireClientSession } from "@/lib/require-auth";
import { fetchBookmarkedPosts } from "@/lib/social-api";

export const Route = createFileRoute("/bookmarks")({
  beforeLoad: requireClientSession,
  head: () => ({
    meta: [
      { title: "Saved pulses — Pulse" },
      {
        name: "description",
        content: "Every pulse you've saved to read again later, in one place.",
      },
      { property: "og:title", content: "Saved pulses — Pulse" },
      {
        property: "og:description",
        content: "Every pulse you've saved to read again later, in one place.",
      },
    ],
  }),
  component: Bookmarks,
});

function Bookmarks() {
  const [items, setItems] = useState<Post[]>([]);

  useEffect(() => {
    fetchBookmarkedPosts()
      .then((fetched) => {
        setItems(fetched);
      })
      .catch(() => undefined);
  }, []);

  return (
    <AppShell>
      <TopBar title="Bookmarks" subtitle="Saved for later" />
      {items.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-muted-foreground">
          No saved pulses yet. Tap the bookmark icon on any pulse to save it for later.
        </p>
      ) : (
        items.map((post) => <PostCard key={post.id} post={post} />)
      )}
    </AppShell>
  );
}
