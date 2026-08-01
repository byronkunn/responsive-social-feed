import { useEffect, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, Flame, MessageCircle, Repeat2, Share2 } from "lucide-react";
import { AppShell } from "@/components/pulse/app-shell";
import { Avatar } from "@/components/pulse/avatar";
import { Button } from "@/components/ui/button";
import { currentUser, repliesFor, type Reply } from "@/lib/pulse-data";
import { createReply, fetchPostById, fetchReplies } from "@/lib/social-api";
import { useProfile } from "@/hooks/use-session";
import { toast } from "sonner";

export const Route = createFileRoute("/post/$postId")({
  loader: async ({ params }) => {
    const post = await fetchPostById(params.postId);
    if (!post) throw notFound();
    return { post, replies: repliesFor(params.postId) };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return { meta: [{ title: "Pulse not found" }, { name: "robots", content: "noindex" }] };
    }
    const title = `${loaderData.post.author.name} on Pulse`;
    const description = loaderData.post.body.slice(0, 150);
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { name: "twitter:card", content: "summary_large_image" },
      ],
    };
  },
  notFoundComponent: PostNotFound,
  component: PostDetail,
});

function PostNotFound() {
  return (
    <AppShell rail={false}>
      <DetailBar />
      <div className="px-6 py-16 text-center">
        <h1 className="font-display text-2xl font-black">This pulse went quiet</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          It may have been deleted, or the link is off by a character.
        </p>
        <Button asChild className="mt-6 rounded-full font-display font-bold">
          <Link to="/">Back to feed</Link>
        </Button>
      </div>
    </AppShell>
  );
}

function DetailBar() {
  return (
    <header className="sticky top-0 z-30 flex items-center gap-4 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:px-6">
      <Link
        to="/"
        aria-label="Back to feed"
        className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
      >
        <ArrowLeft className="size-5" />
      </Link>
      <h1 className="truncate font-display text-xl font-black">Thread</h1>
    </header>
  );
}

function PostDetail() {
  const { post, replies: initial } = Route.useLoaderData();
  const [replies, setReplies] = useState<Reply[]>(initial);
  const [draft, setDraft] = useState("");
  const [sparked, setSparked] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const { profile } = useProfile();
  const remaining = 280 - draft.length;

  const author = profile
    ? { name: profile.display_name, handle: profile.handle, initials: profile.initials }
    : currentUser;

  useEffect(() => {
    fetchReplies(post.id)
      .then((fetched) => {
        if (fetched.length > 0) setReplies(fetched);
      })
      .catch(() => undefined);
  }, [post.id]);

  async function submit() {
    const body = draft.trim();
    if (!body) return;
    setSubmitting(true);
    try {
      await createReply(post.id, body);
      toast.success("Reply posted");
      const updated = await fetchReplies(post.id);
      setReplies(updated);
      setDraft("");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Reply could not be published");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AppShell>
      <DetailBar />

      <article className="border-b border-border px-4 py-5 sm:px-6">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar initials={post.author.initials} />
          <div className="min-w-0">
            <div className="flex min-w-0 items-center gap-1.5">
              <span className="truncate font-display text-sm font-bold">{post.author.name}</span>
              {post.author.verified && <BadgeCheck className="size-4 shrink-0 text-signal" />}
            </div>
            <p className="truncate text-sm text-muted-foreground">@{post.author.handle}</p>
          </div>
        </div>

        <p className="mt-4 font-display text-xl leading-snug break-words sm:text-2xl">
          {post.body}
        </p>

        {post.tag && (
          <Link
            to="/tag/$tag"
            params={{ tag: post.tag }}
            className="mt-4 inline-flex rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-signal"
          >
            #{post.tag}
          </Link>
        )}

        <p className="mt-4 text-xs text-muted-foreground">
          {post.time} ago · <span className="font-semibold text-foreground">{post.views}</span>{" "}
          views
        </p>

        <div className="mt-4 flex flex-wrap items-center gap-x-6 gap-y-2 border-y border-border py-3 text-sm">
          <Stat value={replies.length} label="Replies" />
          <Stat value={post.echoes} label="Echoes" />
          <Stat value={post.sparks + (sparked ? 1 : 0)} label="Sparks" />
        </div>

        <div className="mt-3 flex items-center justify-between gap-2 text-muted-foreground sm:max-w-md">
          <IconBtn icon={MessageCircle} label="Reply" />
          <IconBtn icon={Repeat2} label="Echo" />
          <IconBtn
            icon={Flame}
            label="Spark"
            active={sparked}
            onClick={() => setSparked((v) => !v)}
          />
          <IconBtn icon={Share2} label="Share" />
        </div>
      </article>

      <div className="border-b border-border px-4 py-4 sm:px-6">
        <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
          <Avatar initials={currentUser.initials} />
          <div className="min-w-0">
            <label htmlFor="reply" className="sr-only">
              Post your reply
            </label>
            <textarea
              id="reply"
              rows={2}
              value={draft}
              maxLength={280}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Post your reply"
              className="w-full resize-none bg-transparent text-base leading-snug placeholder:text-muted-foreground focus:outline-none"
            />
            <div className="mt-2 flex items-center justify-between gap-3">
              <span className="text-xs tabular-nums text-muted-foreground">{remaining}</span>
              <Button
                disabled={!draft.trim() || submitting}
                onClick={submit}
                className="h-9 rounded-full px-5 font-display font-bold"
              >
                Reply
              </Button>
            </div>
          </div>
        </div>
      </div>

      {replies.length === 0 ? (
        <p className="px-6 py-10 text-center text-sm text-muted-foreground">
          No replies yet. Be the first voice in the thread.
        </p>
      ) : (
        replies.map((reply) => (
          <article key={reply.id} className="border-b border-border px-4 py-4 sm:px-6">
            <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3">
              <Avatar initials={reply.author.initials} className="size-9" />
              <div className="min-w-0">
                <header className="flex min-w-0 flex-wrap items-center gap-x-2 text-sm">
                  <span className="truncate font-display font-bold">{reply.author.name}</span>
                  {reply.author.verified && <BadgeCheck className="size-4 shrink-0 text-signal" />}
                  <span className="truncate text-muted-foreground">@{reply.author.handle}</span>
                  <span className="text-muted-foreground">· {reply.time}</span>
                </header>
                <p className="mt-1 text-[0.95rem] leading-relaxed break-words text-foreground/90">
                  {reply.body}
                </p>
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Flame className="size-4" /> {reply.sparks}
                </p>
              </div>
            </div>
          </article>
        ))
      )}
    </AppShell>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <p className="text-sm text-muted-foreground">
      <span className="font-display font-bold text-foreground tabular-nums">{value}</span> {label}
    </p>
  );
}

function IconBtn({
  icon: Icon,
  label,
  active,
  onClick,
}: {
  icon: React.ElementType;
  label: string;
  active?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={`inline-flex items-center gap-2 rounded-full px-3 py-2 text-xs transition-colors hover:bg-surface hover:text-foreground sm:text-sm ${
        active ? "text-spark" : ""
      }`}
    >
      <Icon className={`size-[18px] ${active ? "fill-current" : ""}`} />
      <span className="hidden sm:inline">{label}</span>
    </button>
  );
}
