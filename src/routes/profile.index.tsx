import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Lock } from "lucide-react";
import { Avatar } from "@/components/pulse/avatar";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { Button } from "@/components/ui/button";
import { PostCard } from "@/components/pulse/post-card";
import { useHideLikes } from "@/hooks/use-preferences";
import { useProfile } from "@/hooks/use-session";
import {
  currentUser,
  posts,
  replies as seedReplies,
  type Post,
  type Reply,
} from "@/lib/pulse-data";
import { requireClientSession } from "@/lib/require-auth";
import {
  fetchBookmarkedPosts,
  fetchReactedPosts,
  fetchUserPosts,
  fetchUserReplies,
} from "@/lib/social-api";

export const Route = createFileRoute("/profile/")({
  beforeLoad: requireClientSession,
  head: () => ({
    meta: [
      { title: "Your profile — Pulse" },
      {
        name: "description",
        content: "Profile page on Pulse: bio, follower counts and every pulse posted so far.",
      },
      { property: "og:title", content: "Your profile — Pulse" },
      {
        property: "og:description",
        content: "Profile page on Pulse: bio, follower counts and every pulse posted so far.",
      },
    ],
  }),
  component: Profile,
});

const tabs = ["Pulses", "Replies", "Media", "Echoes", "Likes"] as const;
type Tab = (typeof tabs)[number];

function Profile() {
  const [tab, setTab] = useState<Tab>("Pulses");
  const { hideLikes } = useHideLikes();
  const { profile } = useProfile();
  const [userPosts, setUserPosts] = useState<Post[]>([]);
  const [userReplies, setUserReplies] = useState<Reply[]>([]);
  const [echoed, setEchoed] = useState<Post[]>([]);
  const [liked, setLiked] = useState<Post[]>([]);

  const name = profile?.display_name ?? currentUser.name;
  const handle = profile?.handle ?? currentUser.handle;
  const bio =
    profile?.bio ??
    "Building small tools with sharp edges. Interested in local-first software, typography, and the North Sea.";
  const initials = (profile?.initials ?? currentUser.initials).slice(0, 2).toUpperCase();

  useEffect(() => {
    if (profile?.id) {
      if (profile.id.startsWith("local-")) {
        setUserPosts(posts.filter((post) => post.author.handle === "adarowe"));
        setUserReplies(seedReplies.slice(0, 5));
        setEchoed(posts.filter((_, index) => index % 5 === 0));
        setLiked(posts.filter((_, index) => index % 4 === 0));
        return;
      }

      fetchUserPosts(profile.id)
        .then((fetched) => {
          setUserPosts(fetched);
        })
        .catch(() => undefined);
      fetchUserReplies(profile.id)
        .then(setUserReplies)
        .catch(() => undefined);
      fetchReactedPosts("echo")
        .then(setEchoed)
        .catch(() => undefined);
      fetchBookmarkedPosts()
        .then(setLiked)
        .catch(() => undefined);
    }
  }, [profile?.id]);

  const own = userPosts;
  const media = own.filter(
    (post) =>
      post.imageUrl ||
      post.videoUrl ||
      (post.imageUrls && post.imageUrls.length > 0) ||
      (post.videoUrls && post.videoUrls.length > 0),
  );

  return (
    <AppShell>
      <TopBar title={name} subtitle={`${own.length} pulses`} />
      <div className="h-28 gradient-signal sm:h-40" />
      <div className="px-4 pb-4 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <Avatar
            initials={initials}
            className="-mt-10 size-20 rounded-3xl text-xl ring-4 ring-background sm:-mt-12 sm:size-24"
          />
          <Button
            asChild
            variant="secondary"
            className="mb-1 shrink-0 rounded-full font-display font-bold"
          >
            <Link to="/profile/edit">Edit profile</Link>
          </Button>
        </div>
        <h2 className="mt-3 font-display text-xl font-black">{name}</h2>
        <p className="text-sm text-muted-foreground">@{handle}</p>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-foreground/90">{bio}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <Link to="/profile/following" className="hover:underline">
            <strong className="font-display">1,204</strong>{" "}
            <span className="text-muted-foreground">Following</span>
          </Link>
          <Link to="/profile/followers" className="hover:underline">
            <strong className="font-display">18.9K</strong>{" "}
            <span className="text-muted-foreground">Followers</span>
          </Link>
        </div>
      </div>

      <div className="min-w-0 overflow-hidden border-y border-border">
        <div
          role="tablist"
          aria-label="Profile sections"
          className="flex overflow-x-auto px-2 sm:px-4"
        >
          {tabs.map((t) => (
            <button
              key={t}
              role="tab"
              type="button"
              aria-selected={tab === t}
              onClick={() => setTab(t)}
              className={`relative shrink-0 px-4 py-3 font-display text-sm font-bold transition-colors ${
                tab === t ? "text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span className="flex items-center gap-1.5">
                {t}
                {t === "Likes" && hideLikes ? <Lock className="size-3.5" /> : null}
              </span>
              {tab === t ? (
                <span className="absolute inset-x-3 bottom-0 h-1 rounded-full bg-signal" />
              ) : null}
            </button>
          ))}
        </div>
      </div>

      {tab === "Likes" && hideLikes ? (
        <div className="flex items-start gap-3 border-b border-border bg-surface/50 px-4 py-3 sm:px-6">
          <Lock className="mt-0.5 size-4 shrink-0 text-signal" />
          <p className="min-w-0 text-sm text-muted-foreground">
            Your likes are hidden from everyone else. Only you can see this tab —{" "}
            <Link to="/settings" className="font-semibold text-foreground hover:underline">
              change this in settings
            </Link>
            .
          </p>
        </div>
      ) : null}

      {tab === "Pulses" &&
        (own.length ? (
          own.map((p) => <PostCard key={p.id} post={p} />)
        ) : (
          <Empty label="No pulses posted yet" />
        ))}

      {tab === "Replies" &&
        (userReplies.length ? (
          userReplies.slice(0, 25).map((r) => (
            <article key={r.id} className="border-b border-border px-4 py-4 sm:px-6">
              <p className="text-xs text-muted-foreground">
                Replying to{" "}
                <Link to="/post/$postId" params={{ postId: r.postId }} className="hover:underline">
                  a pulse
                </Link>
              </p>
              <div className="mt-2 flex gap-3">
                <Avatar initials={initials} className="size-10 shrink-0" />
                <div className="min-w-0">
                  <p className="font-display text-sm font-bold">
                    {name}{" "}
                    <span className="font-sans font-normal text-muted-foreground">
                      @{handle} · {r.time}
                    </span>
                  </p>
                  <p className="mt-1 text-sm leading-relaxed">{r.body}</p>
                </div>
              </div>
            </article>
          ))
        ) : (
          <Empty label="No replies yet" />
        ))}

      {tab === "Media" &&
        (media.length ? (
          media.map((p) => <PostCard key={p.id} post={p} />)
        ) : (
          <Empty label="No media attached yet" />
        ))}

      {tab === "Echoes" &&
        (echoed.length ? (
          echoed.map((p) => <PostCard key={p.id} post={p} />)
        ) : (
          <Empty label="No echoes yet" />
        ))}

      {tab === "Likes" &&
        (liked.length ? (
          liked.map((p) => <PostCard key={p.id} post={p} />)
        ) : (
          <Empty label="No liked pulses yet" />
        ))}
    </AppShell>
  );
}

function Empty({ label }: { label: string }) {
  return <p className="px-4 py-10 text-center text-sm text-muted-foreground sm:px-6">{label}</p>;
}
