import { useState, type ElementType } from "react";
import { Link } from "@tanstack/react-router";
import {
  MessageCircle,
  Repeat2,
  Flame,
  BarChart3,
  Bookmark,
  BadgeCheck,
  Trash2,
  X,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Avatar } from "./avatar";
import { MediaGrid } from "./media-grid";
import { cn } from "@/lib/utils";
import { gallery } from "@/lib/pulse-data";
import type { Post } from "@/lib/pulse-data";
import { deletePost, toggleReaction } from "@/lib/social-api";
import { useProfile } from "@/hooks/use-session";
import { toast } from "sonner";

function compact(n: number) {
  return n >= 1000 ? `${(n / 1000).toFixed(1)}K` : `${n}`;
}

export function PostCard({ post, onDelete }: { post: Post; onDelete?: (id: string) => void }) {
  const { profile } = useProfile();
  const [sparked, setSparked] = useState(false);
  const [echoed, setEchoed] = useState(false);
  const [saved, setSaved] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const isUuid = /^[0-9a-f]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(
    post.id,
  );
  const isOwner =
    isUuid && profile && profile.handle.toLowerCase() === post.author.handle.toLowerCase();

  if (deleted) return null;

  async function handleDelete() {
    try {
      await deletePost(post.id);
      setDeleted(true);
      if (onDelete) onDelete(post.id);
      toast.success("Pulse deleted");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not delete pulse");
    }
  }

  async function toggle(
    kind: "spark" | "echo" | "bookmark",
    active: boolean,
    local: (value: boolean) => void,
  ) {
    if (!isUuid) {
      local(!active);
      return;
    }
    try {
      local(await toggleReaction(post.id, kind, active));
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "That action could not be saved");
    }
  }

  return (
    <article className="border-b border-border px-4 py-4 transition-colors hover:bg-surface/60 sm:px-6">
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 sm:gap-4">
        <Link
          to="/user/$handle"
          params={{ handle: post.author.handle }}
          aria-label={`Open ${post.author.name}'s profile`}
          className="self-start rounded-2xl focus:outline-none focus:ring-2 focus:ring-signal focus:ring-offset-2 focus:ring-offset-background"
        >
          <Avatar initials={post.author.initials} />
        </Link>
        <div className="min-w-0">
          <header className="flex min-w-0 flex-wrap items-center justify-between gap-x-2 gap-y-0.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5">
              <Link
                to="/user/$handle"
                params={{ handle: post.author.handle }}
                className="truncate font-display text-sm font-bold hover:underline"
              >
                {post.author.name}
              </Link>
              {post.author.verified && (
                <BadgeCheck className="size-4 shrink-0 text-signal" aria-label="Verified" />
              )}
              <Link
                to="/user/$handle"
                params={{ handle: post.author.handle }}
                className="truncate text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                @{post.author.handle}
              </Link>
              <Link
                to="/post/$postId"
                params={{ postId: post.id }}
                className="text-sm text-muted-foreground hover:text-foreground hover:underline"
              >
                · {post.time}
              </Link>
            </div>
            {isOwner && (
              <button
                type="button"
                onClick={handleDelete}
                aria-label="Delete pulse"
                className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-destructive"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </header>

          {(() => {
            const imageMatches = Array.from(post.body.matchAll(/!\[Image\]\((.*?)\)/g));
            const videoMatches = Array.from(post.body.matchAll(/!\[Video\]\((.*?)\)/g));
            const extractedImages = imageMatches.map((m) => m[1]).filter(Boolean) as string[];
            const extractedVideos = videoMatches.map((m) => m[1]).filter(Boolean) as string[];
            const cleanBody = post.body
              .replace(/!\[Image\]\((.*?)\)/g, "")
              .replace(/!\[Video\]\((.*?)\)/g, "")
              .trim();

            const allImages = Array.from(
              new Set([
                ...(post.imageUrls ?? []),
                ...(post.imageUrl ? [post.imageUrl] : []),
                ...extractedImages,
              ]),
            );
            const allVideos = Array.from(
              new Set([
                ...(post.videoUrls ?? []),
                ...(post.videoUrl ? [post.videoUrl] : []),
                ...extractedVideos,
              ]),
            );

            return (
              <>
                {cleanBody && (
                  <Link
                    to="/post/$postId"
                    params={{ postId: post.id }}
                    className="mt-1.5 block text-[0.95rem] leading-relaxed break-words text-foreground/90"
                  >
                    {cleanBody}
                  </Link>
                )}

                {allImages.length > 0 && <ImageGallery images={allImages} />}
                {allVideos.length > 0 && <VideoGallery videos={allVideos} />}
              </>
            );
          })()}

          {gallery[post.id] && <MediaGrid items={gallery[post.id]!} />}

          {post.tag && (
            <Link
              to="/tag/$tag"
              params={{ tag: post.tag }}
              className="mt-3 inline-flex rounded-full bg-surface-2 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:text-signal"
            >
              #{post.tag}
            </Link>
          )}

          <div className="mt-3 flex max-w-md items-center justify-between gap-1 text-muted-foreground">
            <Action
              icon={MessageCircle}
              label={compact(post.replies)}
              ariaLabel="Show replies"
              hover="hover:text-signal"
              toPostId={post.id}
            />
            <Action
              icon={Repeat2}
              label={compact(post.echoes + (echoed ? 1 : 0))}
              hover="hover:text-echo"
              active={echoed}
              activeClass="text-echo"
              ariaLabel="Echo"
              onClick={() => void toggle("echo", echoed, setEchoed)}
            />
            <Action
              icon={Flame}
              label={compact(post.sparks + (sparked ? 1 : 0))}
              hover="hover:text-spark"
              active={sparked}
              activeClass="text-spark"
              ariaLabel="Spark"
              onClick={() => void toggle("spark", sparked, setSparked)}
            />
            <Action
              icon={BarChart3}
              label={post.views}
              ariaLabel="View pulse metrics"
              hover="hover:text-signal"
              toPostId={post.id}
            />
            <Action
              icon={Bookmark}
              hover="hover:text-signal"
              active={saved}
              activeClass="text-signal"
              ariaLabel="Bookmark"
              onClick={() => void toggle("bookmark", saved, setSaved)}
            />
          </div>
        </div>
      </div>
    </article>
  );
}

function VideoGallery({ videos }: { videos: string[] }) {
  return (
    <div className="mt-3 grid gap-2">
      {videos.map((url, index) => (
        <video
          key={`${url}-${index}`}
          src={url}
          controls
          preload="metadata"
          className="aspect-video w-full rounded-2xl border border-border bg-black object-cover"
        >
          <a href={url}>Download video {index + 1}</a>
        </video>
      ))}
    </div>
  );
}

function ImageGallery({ images }: { images: string[] }) {
  const [openIndex, setOpenIndex] = useState<number | null>(null);

  if (!images.length) return null;

  const displayCount = Math.min(images.length, 4);
  const remainingCount = images.length - 4;

  return (
    <>
      <div
        className={cn(
          "mt-3 grid gap-1.5 overflow-hidden rounded-2xl border border-border bg-surface",
          displayCount === 1 && "grid-cols-1",
          displayCount === 2 && "grid-cols-2",
          displayCount >= 3 && "grid-cols-2 sm:grid-cols-2",
        )}
      >
        {images.slice(0, displayCount).map((url, index) => (
          <button
            key={`${url}-${index}`}
            type="button"
            onClick={(e) => {
              e.preventDefault();
              setOpenIndex(index);
            }}
            className={cn(
              "relative aspect-[16/10] w-full overflow-hidden bg-surface group",
              displayCount === 3 && index === 0 && "col-span-2 aspect-[16/8]",
            )}
          >
            <img
              src={url}
              alt={`Attached image ${index + 1}`}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-105"
            />
            {index === 3 && remainingCount > 0 && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/70 backdrop-blur-xs font-display text-lg font-bold text-foreground">
                +{remainingCount} more
              </div>
            )}
          </button>
        ))}
      </div>

      {openIndex !== null && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 grid place-items-center bg-background/95 p-4 backdrop-blur"
          onClick={() => setOpenIndex(null)}
        >
          <button
            type="button"
            aria-label="Close image viewer"
            onClick={() => setOpenIndex(null)}
            className="absolute top-4 right-4 grid size-10 place-items-center rounded-full bg-surface text-foreground hover:bg-surface-2"
          >
            <X className="size-5" />
          </button>

          <figure className="relative max-h-[85vh] max-w-4xl" onClick={(e) => e.stopPropagation()}>
            <img
              src={images[openIndex]}
              alt={`Image ${openIndex + 1} of ${images.length}`}
              className="max-h-[80vh] w-auto max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </figure>

          {images.length > 1 && (
            <div className="absolute inset-x-0 bottom-8 flex items-center justify-center gap-4">
              <button
                type="button"
                aria-label="Previous image"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenIndex((i) => ((i ?? 0) - 1 + images.length) % images.length);
                }}
                className="grid size-11 place-items-center rounded-full bg-surface hover:bg-surface-2"
              >
                <ChevronLeft className="size-5" />
              </button>
              <span className="text-xs tabular-nums text-muted-foreground font-semibold">
                {openIndex + 1} / {images.length}
              </span>
              <button
                type="button"
                aria-label="Next image"
                onClick={(e) => {
                  e.stopPropagation();
                  setOpenIndex((i) => ((i ?? 0) + 1) % images.length);
                }}
                className="grid size-11 place-items-center rounded-full bg-surface hover:bg-surface-2"
              >
                <ChevronRight className="size-5" />
              </button>
            </div>
          )}
        </div>
      )}
    </>
  );
}

function Action({
  icon: Icon,
  label,
  ariaLabel,
  hover,
  active,
  activeClass,
  onClick,
  toPostId,
}: {
  icon: ElementType;
  label?: string;
  ariaLabel: string;
  hover: string;
  active?: boolean;
  activeClass?: string;
  onClick?: () => void;
  toPostId?: string;
}) {
  const className = cn(
    "group -ml-1 inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs transition-colors sm:text-sm",
    hover,
    active && activeClass,
  );
  const contents = (
    <>
      <Icon
        className={cn(
          "size-[18px] transition-transform group-hover:scale-110",
          active && "fill-current",
        )}
      />
      {label && <span className="tabular-nums">{label}</span>}
    </>
  );

  if (toPostId) {
    return (
      <Link
        to="/post/$postId"
        params={{ postId: toPostId }}
        aria-label={ariaLabel}
        className={className}
      >
        {contents}
      </Link>
    );
  }

  return (
    <button type="button" aria-label={ariaLabel} onClick={onClick} className={className}>
      {contents}
    </button>
  );
}
