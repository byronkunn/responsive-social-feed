import { useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck } from "lucide-react";
import { AppShell } from "@/components/pulse/app-shell";
import { Avatar } from "@/components/pulse/avatar";
import { PostCard } from "@/components/pulse/post-card";
import { Button } from "@/components/ui/button";
import { type Author, type Post } from "@/lib/pulse-data";
import { fetchPostsByHandle, fetchProfileByHandle, toggleFollowProfile } from "@/lib/social-api";
import { toast } from "sonner";

type PublicProfile = Author & {
  bio: string;
};

export const Route = createFileRoute("/user/$handle")({
  loader: async ({ params }) => {
    const handle = params.handle.toLowerCase();

    try {
      const profile = await fetchProfileByHandle(handle);
      if (profile) {
        const posts = await fetchPostsByHandle(profile.handle);
        return {
          profile: {
            name: profile.display_name,
            handle: profile.handle,
            initials: profile.initials,
            bio: profile.bio || "Sharing pulses, media, replies, and work in progress.",
          },
          posts,
        };
      }
    } catch {
      throw notFound();
    }

    throw notFound();
  },
  head: ({ loaderData }) => {
    const profile = loaderData?.profile;
    const title = profile ? `${profile.name} (@${profile.handle}) — Pulse` : "Profile not found";
    return {
      meta: [
        { title },
        {
          name: "description",
          content: profile
            ? `View ${profile.name}'s public Pulse profile and posts.`
            : "Pulse profile not found.",
        },
      ],
    };
  },
  notFoundComponent: UserNotFound,
  component: UserProfile,
});

function UserNotFound() {
  return (
    <AppShell rail={false}>
      <UserBar title="Profile" />
      <div className="px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-black">Profile not found</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          That handle does not match a public Pulse profile.
        </p>
        <Button asChild className="mt-6 rounded-full font-display font-bold">
          <Link to="/">Back to feed</Link>
        </Button>
      </div>
    </AppShell>
  );
}

function UserProfile() {
  const { profile, posts } = Route.useLoaderData() as {
    profile: PublicProfile;
    posts: Post[];
  };
  const [following, setFollowing] = useState(false);
  const mediaPosts = posts.filter(
    (post) =>
      post.imageUrl ||
      post.videoUrl ||
      (post.imageUrls && post.imageUrls.length > 0) ||
      (post.videoUrls && post.videoUrls.length > 0),
  );

  async function toggleFollow() {
    const previous = following;
    setFollowing(!previous);
    try {
      await toggleFollowProfile(profile.handle, previous);
      toast.success(previous ? `Unfollowed @${profile.handle}` : `Following @${profile.handle}`);
    } catch (error) {
      if (!import.meta.env.DEV) {
        setFollowing(previous);
        toast.error(error instanceof Error ? error.message : "Follow update failed");
      }
    }
  }

  return (
    <AppShell>
      <UserBar title={profile.name} subtitle={`${posts.length} pulses`} />
      <div className="h-28 gradient-signal sm:h-40" />
      <section className="border-b border-border px-4 pb-5 sm:px-6">
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-3">
          <Avatar
            initials={profile.initials}
            className="-mt-10 size-20 rounded-3xl text-xl ring-4 ring-background sm:-mt-12 sm:size-24"
          />
          <Button
            variant={following ? "default" : "secondary"}
            onClick={() => void toggleFollow()}
            className="mb-1 shrink-0 rounded-full font-display font-bold"
          >
            {following ? "Following" : "Follow"}
          </Button>
        </div>
        <div className="mt-3 flex min-w-0 items-center gap-1.5">
          <h1 className="truncate font-display text-xl font-black">{profile.name}</h1>
          {profile.verified && <BadgeCheck className="size-4 shrink-0 text-signal" />}
        </div>
        <p className="text-sm text-muted-foreground">@{profile.handle}</p>
        <p className="mt-3 max-w-prose text-sm leading-relaxed text-foreground/90">{profile.bio}</p>
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
          <span>
            <strong className="font-display">{posts.length}</strong>{" "}
            <span className="text-muted-foreground">Pulses</span>
          </span>
          <span>
            <strong className="font-display">{mediaPosts.length}</strong>{" "}
            <span className="text-muted-foreground">Media</span>
          </span>
        </div>
      </section>

      {posts.length > 0 ? (
        posts.map((post) => <PostCard key={post.id} post={post} />)
      ) : (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">
          No public pulses yet.
        </p>
      )}
    </AppShell>
  );
}

function UserBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:px-6">
      <Link
        to="/"
        aria-label="Back to feed"
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
      >
        <ArrowLeft className="size-5" />
      </Link>
      <div className="min-w-0">
        <h1 className="truncate font-display text-xl font-black">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
    </header>
  );
}
