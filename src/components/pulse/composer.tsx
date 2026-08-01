import { useRef, useState } from "react";
import { Image, Smile, X } from "lucide-react";
import { toast } from "sonner";
import { Avatar } from "./avatar";
import { Button } from "@/components/ui/button";
import { useProfile } from "@/hooks/use-session";
import { currentUser } from "@/lib/pulse-data";
import { uploadMultipleMedia } from "@/lib/social-api";

const LIMIT = 280;
const MAX_MEDIA = 20;

export function Composer({
  onPost,
}: {
  onPost: (body: string, imageUrls?: string[]) => void | Promise<void>;
}) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [files, setFiles] = useState<{ file: File; previewUrl: string; type: "image" | "video" }[]>(
    [],
  );
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const { profile } = useProfile();

  const user = profile
    ? { name: profile.display_name, handle: profile.handle, initials: profile.initials }
    : currentUser;

  const remaining = LIMIT - value.length;
  const canPost = (value.trim().length > 0 || files.length > 0) && remaining >= 0;

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? []);
    if (selected.length === 0) return;

    if (files.length + selected.length > MAX_MEDIA) {
      toast.error(`You can attach a maximum of ${MAX_MEDIA} media items per post.`);
    }

    const availableSlots = MAX_MEDIA - files.length;
    const toAdd = selected.slice(0, availableSlots).map((file) => ({
      file,
      previewUrl: URL.createObjectURL(file),
      type: file.type.startsWith("video/") ? ("video" as const) : ("image" as const),
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
      setValue((current) => `${current}${emoji}`);
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
    <div className="border-b border-border px-4 py-4 sm:px-6">
      <input
        type="file"
        ref={fileInputRef}
        accept="image/*,video/*"
        multiple
        onChange={handleFileSelect}
        className="hidden"
      />
      <div className="grid grid-cols-[auto_minmax(0,1fr)] gap-3 sm:gap-4">
        <Avatar initials={user.initials} />
        <div className="min-w-0">
          <label htmlFor="composer" className="sr-only">
            What's pulsing?
          </label>
          <textarea
            id="composer"
            ref={textareaRef}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            rows={2}
            placeholder="What's pulsing?"
            className="w-full resize-none bg-transparent font-display text-lg leading-snug placeholder:text-muted-foreground focus:outline-none"
          />

          {files.length > 0 && (
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground font-semibold">
                <span>
                  {files.length} / {MAX_MEDIA} media attached
                </span>
                <button
                  type="button"
                  onClick={clearAllFiles}
                  className="text-signal hover:underline"
                >
                  Remove all
                </button>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 max-h-72 overflow-y-auto pr-1">
                {files.map((item, idx) => (
                  <div
                    key={`${item.file.name}-${idx}`}
                    className="relative aspect-square overflow-hidden rounded-xl border border-border group bg-surface"
                  >
                    {item.type === "video" ? (
                      <video
                        src={item.previewUrl}
                        aria-label={`Video preview ${idx + 1}`}
                        muted
                        className="size-full object-cover"
                      />
                    ) : (
                      <img
                        src={item.previewUrl}
                        alt={`Preview ${idx + 1}`}
                        className="size-full object-cover"
                      />
                    )}
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

          <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
            <div className="flex min-w-0 items-center gap-0.5 text-signal">
              <button
                type="button"
                aria-label="Add images"
                disabled={files.length >= MAX_MEDIA}
                onClick={() => fileInputRef.current?.click()}
                className="grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-surface-2 disabled:opacity-40"
              >
                <Image className="size-[18px]" />
              </button>
              <button
                type="button"
                aria-label="Add emoji"
                onClick={insertEmoji}
                className="grid size-9 shrink-0 place-items-center rounded-full transition-colors hover:bg-surface-2"
              >
                <Smile className="size-[18px]" />
              </button>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              {value.length > 0 && (
                <span
                  className={`text-xs tabular-nums ${remaining < 0 ? "text-destructive" : "text-muted-foreground"}`}
                >
                  {remaining}
                </span>
              )}
              <Button
                disabled={!canPost || busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    let uploadedUrls: string[] | undefined;
                    if (files.length > 0) {
                      uploadedUrls = await uploadMultipleMedia(files.map((f) => f.file));
                    }
                    await onPost(value.trim(), uploadedUrls);
                    setValue("");
                    clearAllFiles();
                  } catch (err) {
                    toast.error(err instanceof Error ? err.message : "Failed to post content");
                  } finally {
                    setBusy(false);
                  }
                }}
                className="h-9 rounded-full px-5 font-display font-bold"
              >
                Pulse
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
