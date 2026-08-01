import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { Composer } from "@/components/pulse/composer";
import { PostCard } from "@/components/pulse/post-card";
import { useProfile } from "@/hooks/use-session";
import { type Post } from "@/lib/pulse-data";
import { createPost, fetchPosts } from "@/lib/social-api";
import { toast } from "sonner";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pulse — A calmer place to think out loud" },
      {
        name: "description",
        content:
          "Pulse is a lightweight microblog: post short thoughts, echo what resonates, and follow the topics moving right now.",
      },
      { property: "og:title", content: "Pulse — A calmer place to think out loud" },
      {
        property: "og:description",
        content: "Post short thoughts, echo what resonates, and follow what's moving right now.",
      },
    ],
  }),
  component: Home,
});

function Home() {
  const [tab, setTab] = useState<"forYou" | "following">("forYou");
  const [posts, setPosts] = useState<Post[]>([]);
  const [loadError, setLoadError] = useState(false);
  const { profile } = useProfile();

  useEffect(() => {
    fetchPosts()
      .then((persisted) => {
        setPosts(persisted);
        setLoadError(false);
      })
      .catch(() => {
        setPosts([]);
        setLoadError(true);
      });
  }, []);

  const visible = tab === "forYou" ? posts : posts.filter((_, i) => i % 2 === 0);

  return (
    <AppShell>
      <TopBar title="Home" />
      <div className="sticky top-[57px] z-20 grid grid-cols-2 border-b border-border bg-background/85 backdrop-blur">
        {(
          [
            ["forYou", "For you"],
            ["following", "Following"],
          ] as const
        ).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`relative px-4 py-3.5 font-display text-sm font-semibold transition-colors ${
              tab === key ? "text-foreground" : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {label}
            {tab === key && (
              <span className="absolute inset-x-[35%] bottom-0 h-1 rounded-full gradient-signal" />
            )}
          </button>
        ))}
      </div>

      <Composer
        onPost={async (body, imageUrls) => {
          try {
            await createPost(body, "Everyone", imageUrls);
            const persisted = await fetchPosts();
            setPosts(persisted);
            setLoadError(false);
          } catch (error) {
            if (import.meta.env.DEV && profile?.id.startsWith("local-")) {
              const author = {
                name: profile.display_name,
                handle: profile.handle,
                initials: profile.initials,
              };
              const media = imageUrls ?? [];
              const localPost: Post = {
                id: `local-post-${Date.now()}`,
                author,
                time: "now",
                body,
                replies: 0,
                echoes: 0,
                sparks: 0,
                views: "1",
                imageUrls: media.filter((url) => !/\.(mp4|webm|ogg)(\?|#|$)/i.test(url)),
                videoUrls: media.filter((url) => /\.(mp4|webm|ogg)(\?|#|$)/i.test(url)),
              };
              setPosts((current) => [localPost, ...current]);
              toast.success("Pulse published locally");
              return;
            }
            toast.error(error instanceof Error ? error.message : "The post could not be published");
          }
        }}
      />

      {loadError ? (
        <p className="border-b border-border bg-surface/50 px-6 py-3 text-sm text-muted-foreground">
          Live posts are unavailable. Apply the Supabase migrations to populate the feed.
        </p>
      ) : null}

      {visible.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-muted-foreground">
          No pulses yet. Post your first thought above to start the feed.
        </p>
      ) : (
        <div>
          {visible.map((post) => (
            <PostCard key={post.id} post={post} />
          ))}
        </div>
      )}

      <p className="px-6 py-10 text-center text-sm text-muted-foreground">You're all caught up.</p>
    </AppShell>
  );
}
