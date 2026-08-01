import { useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { X, Image, Smile, Globe2 } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "@/components/pulse/avatar";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-session";
import { currentUser } from "@/lib/pulse-data";
import { requireClientSession } from "@/lib/require-auth";
import {
  createPost,
  deleteDraft,
  saveDraft,
  updateDraft,
  uploadMedia,
  uploadMultipleMedia,
} from "@/lib/social-api";

const LIMIT = 280;
const MAX_IMAGES = 20;

export const Route = createFileRoute("/compose")({
  beforeLoad: requireClientSession,
  validateSearch: (search: Record<string, unknown>) => ({
    draft: typeof search["draft"] === "string" ? search["draft"] : undefined,
    body: typeof search["body"] === "string" ? search["body"].slice(0, LIMIT) : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Write a new pulse" },
      { name: "description", content: "Compose and publish a new pulse in a full-screen editor." },
      { property: "og:title", content: "Write a new pulse" },
      {
        property: "og:description",
        content: "Compose and publish a new pulse in a full-screen editor.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ComposePage,
});

function ComposePage() {
  const search = Route.useSearch();
  const [value, setValue] = useState(search.body ?? "");
  const [audience, setAudience] = useState<"Everyone" | "Followers">("Everyone");
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<{ file: File; previewUrl: string }[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const navigate = useNavigate();
  const { profile } = useProfile();

  const user = profile
    ? { name: profile.display_name, handle: profile.handle, initials: profile.initials }
    : currentUser;

  const remaining = LIMIT - value.length;
  const canPost = (value.trim().length > 0 || files.length > 0) && remaining >= 0;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    if (files.length + selected.length > MAX_IMAGES) {
      toast.error(`You can attach a maximum of ${MAX_IMAGES} images per post.`);
    }

    const availableSlots = MAX_IMAGES - files.length;
    const toAdd = selected.slice(0, availableSlots).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
    }));

    setFiles((prev) => [...prev, ...toAdd]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removeFile(index: number) {
    setFiles((prev) => {
      const target = prev[index];
      if (target) URL.revokeObjectURL(target.previewUrl);
      return prev.filter((_, i) => i !== index);
    });
  }

  function clearAllFiles() {
    files.forEach((f) => URL.revokeObjectURL(f.previewUrl));
    setFiles([]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function insertEmoji() {
    const textarea = textareaRef.current;
    const emoji = "🙂";
    if (!textarea) {
      setValue((current) => `${current}${emoji}`.slice(0, LIMIT));
      return;
    }

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const next = `${value.slice(0, start)}${emoji}${value.slice(end)}`.slice(0, LIMIT);
    setValue(next);
    requestAnimationFrame(() => {
      const position = Math.min(start + emoji.length, next.length);
      textarea.focus();
      textarea.setSelectionRange(position, position);
    });
  }

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl flex-col px-4 py-4 sm:px-6">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      <header className="flex items-center justify-between gap-3">
        <button
          type="button"
          aria-label="Close composer"
          onClick={() => navigate({ to: "/" })}
          className="grid size-10 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface"
        >
          <X className="size-5" />
        </button>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            className="rounded-full text-sm text-muted-foreground"
            onClick={async () => {
              setBusy(true);
              try {
                if (search.draft) await updateDraft(search.draft, value, audience);
                else await saveDraft(value, audience);
                toast.success("Saved to drafts");
                navigate({ to: "/drafts" });
              } catch (error) {
                toast.error(error instanceof Error ? error.message : "Draft could not be saved");
              } finally {
                setBusy(false);
              }
            }}
            disabled={value.trim().length === 0 || busy}
          >
            Save draft
          </Button>
          <Button
            disabled={!canPost || busy}
            onClick={async () => {
              setBusy(true);
              try {
                let uploadedUrls: string[] | undefined;
                if (files.length > 0) {
                  uploadedUrls = await uploadMultipleMedia(files.map((f) => f.file));
                }
                await createPost(value, audience, uploadedUrls);
                if (search.draft) await deleteDraft(search.draft);
                toast.success("Pulse published");
                navigate({ to: "/" });
              } catch (error) {
                toast.error(
                  error instanceof Error ? error.message : "Pulse could not be published",
                );
              } finally {
                setBusy(false);
              }
            }}
            className="h-9 rounded-full px-5 font-display font-bold"
          >
            Pulse
          </Button>
        </div>
      </header>

      <div className="mt-5 grid flex-1 grid-cols-[auto_minmax(0,1fr)] gap-3 sm:gap-4">
        <Avatar initials={user.initials} />
        <div className="flex min-w-0 flex-col">
          <button
            type="button"
            onClick={() => setAudience((a) => (a === "Everyone" ? "Followers" : "Everyone"))}
            className="mb-3 inline-flex w-fit items-center gap-1.5 rounded-full border border-border px-3 py-1 text-xs font-semibold text-signal"
          >
            <Globe2 className="size-3.5" />
            {audience} can reply
          </button>
          <label htmlFor="compose-full" className="sr-only">
            What's pulsing?
          </label>
          <textarea
            id="compose-full"
            ref={textareaRef}
            autoFocus
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="What's pulsing?"
            className="min-h-32 w-full flex-1 resize-none bg-transparent font-display text-xl leading-snug placeholder:text-muted-foreground focus:outline-none"
          />

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                <span>
                  {files.length} / {MAX_IMAGES} images attached
                </span>
                <button
                  type="button"
                  onClick={clearAllFiles}
                  className="text-signal hover:underline"
                >
                  Remove all
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-80 overflow-y-auto pr-1">
                {files.map((item, idx) => (
                  <div
                    key={`${item.file.name}-${idx}`}
                    className="relative aspect-square overflow-hidden rounded-xl border border-border group bg-surface"
                  >
                    <img
                      src={item.previewUrl}
                      alt={`Preview ${idx + 1}`}
                      className="size-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeFile(idx)}
                      className="absolute top-1.5 right-1.5 grid size-6 place-items-center rounded-full bg-background/80 text-foreground backdrop-blur hover:bg-background"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      <footer className="sticky bottom-0 mt-4 flex items-center justify-between gap-3 border-t border-border bg-background/90 py-3 backdrop-blur">
        <div className="flex items-center gap-0.5 text-signal">
          <button
            type="button"
            aria-label="Add images"
            disabled={files.length >= MAX_IMAGES}
            onClick={() => fileInputRef.current?.click()}
            className="grid size-10 place-items-center rounded-full transition-colors hover:bg-surface-2 disabled:opacity-40"
          >
            <Image className="size-[18px]" />
          </button>
          <button
            type="button"
            aria-label="Add emoji"
            onClick={insertEmoji}
            className="grid size-10 place-items-center rounded-full transition-colors hover:bg-surface-2"
          >
            <Smile className="size-[18px]" />
          </button>
        </div>
        <span
          className={`text-sm tabular-nums ${remaining < 0 ? "text-destructive" : "text-muted-foreground"}`}
        >
          {remaining}
        </span>
      </footer>
    </main>
  );
}
