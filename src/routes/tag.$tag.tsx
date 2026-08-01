import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, Bell, BellOff, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/pulse/app-shell";
import { PostCard } from "@/components/pulse/post-card";
import { Button } from "@/components/ui/button";
import { useFollowedTags } from "@/hooks/use-preferences";
import { type Post } from "@/lib/pulse-data";
import { fetchPosts } from "@/lib/social-api";

export const Route = createFileRoute("/tag/$tag")({
  head: ({ params }) => {
    const title = `#${params.tag} on Pulse`;
    const description = `Every pulse tagged #${params.tag}, newest conversations first.`;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: TagPage,
});

function TagPage() {
  const { tag } = Route.useParams();
  const [taggedPosts, setTaggedPosts] = useState<Post[]>([]);
  const { isFollowing, toggleTag } = useFollowedTags();
  const following = isFollowing(tag);

  useEffect(() => {
    fetchPosts()
      .then((all) => {
        const matching = all.filter(
          (p) =>
            (p.tag ?? "").toLowerCase() === tag.toLowerCase() ||
            p.body.toLowerCase().includes(tag.toLowerCase()),
        );
        setTaggedPosts(matching);
      })
      .catch(() => undefined);
  }, [tag]);

  return (
    <AppShell>
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:px-6">
        <Link
          to="/explore"
          aria-label="Back to explore"
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="min-w-0 flex-1">
          <h1 className="truncate font-display text-xl font-black">#{tag}</h1>
          <p className="truncate text-xs text-muted-foreground">
            {taggedPosts.length} post{taggedPosts.length === 1 ? "" : "s"}
          </p>
        </div>
        <Button
          size="sm"
          variant={following ? "default" : "secondary"}
          onClick={() => {
            toggleTag(tag);
            toast.success(following ? `Unfollowed #${tag}` : `Following #${tag}`);
          }}
          aria-pressed={following}
          className="shrink-0 rounded-full font-semibold"
        >
          {following ? <BellOff className="size-4" /> : <Bell className="size-4" />}
          <span className="hidden sm:inline">{following ? "Following" : "Follow tag"}</span>
        </Button>
      </header>

      <div className="flex items-start gap-3 border-b border-border bg-surface/50 px-4 py-4 sm:px-6">
        <TrendingUp className="mt-0.5 size-4 shrink-0 text-signal" />
        <p className="min-w-0 text-sm text-muted-foreground">
          <span className="font-display font-bold text-foreground">#{tag}</span> tag feed across the
          network.
        </p>
      </div>

      {taggedPosts.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-muted-foreground">
          No pulses found tagged #{tag}. Post a thought above to start this tag feed!
        </p>
      ) : (
        taggedPosts.map((post) => <PostCard key={post.id} post={post} />)
      )}
    </AppShell>
  );
}
