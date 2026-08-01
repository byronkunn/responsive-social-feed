import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import {
  ArrowLeft,
  BadgeCheck,
  ChevronLeft,
  ChevronRight,
  ImagePlus,
  Images,
  Info,
  Link2,
  Search,
  Send,
  Smile,
  Trash2,
  UserPlus,
  Video,
  X,
} from "lucide-react";
import { AppShell } from "@/components/pulse/app-shell";
import { Avatar } from "@/components/pulse/avatar";
import { ConversationList, isOnline } from "@/components/pulse/conversation-list";
import { Button } from "@/components/ui/button";
import {
  type Author,
  type ChatAttachment,
  type ChatMessage,
  type Conversation,
} from "@/lib/pulse-data";
import { requireClientSession } from "@/lib/require-auth";
import {
  createConversationWith,
  deleteMessageAttachmentForBoth,
  deleteMessageForBoth,
  deleteMessageForMe,
  fetchConversation,
  searchProfiles,
  sendMessage,
  uploadMultipleMedia,
} from "@/lib/social-api";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type MediaFilter = "all" | "images" | "videos" | "urls";
type PendingAttachment = ChatAttachment & { file?: File; objectUrl?: string };
type LightboxMedia = ChatAttachment & { messageId?: string };

export const Route = createFileRoute("/messages/$conversationId")({
  beforeLoad: requireClientSession,
  loader: async ({ params }) => {
    if (params.conversationId === "new") {
      return {
        conversation: {
          id: "new",
          person: {
            name: "New Message",
            handle: "new",
            initials: "DM",
          },
          preview: "Start a private conversation...",
          time: "now",
          messages: [],
        },
      };
    }

    const isUuid = /^[0-9a-f]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(
      params.conversationId,
    );
    if (!isUuid) throw notFound();

    const conversation = await fetchConversation(params.conversationId).catch(() => null);
    if (!conversation) throw notFound();

    return { conversation };
  },
  head: ({ loaderData }) => {
    const title = `Chat with ${loaderData?.conversation.person.name ?? "Messages"} — Pulse`;
    return {
      meta: [
        { title },
        { name: "description", content: "A private Pulse conversation." },
        { name: "robots", content: "noindex" },
        { property: "og:title", content: title },
        { property: "og:description", content: "A private Pulse conversation." },
        { property: "og:type", content: "website" },
        { name: "twitter:card", content: "summary" },
      ],
    };
  },
  component: ConversationPage,
});

function ConversationPage() {
  const { conversation } = Route.useLoaderData();

  return (
    <AppShell rail={false}>
      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="hidden min-w-0 border-r border-border lg:block">
          <div className="border-b border-border px-4 py-3">
            <h2 className="font-display text-base font-black">Messages</h2>
          </div>
          <ConversationList activeId={conversation.id} compact />
        </aside>
        <Thread key={conversation.id} initialConversation={conversation} />
      </div>
    </AppShell>
  );
}

function Thread({ initialConversation }: { initialConversation: Conversation }) {
  const [conversation, setConversation] = useState(initialConversation);
  const [messages, setMessages] = useState<ChatMessage[]>(initialConversation.messages);
  const [value, setValue] = useState("");
  const [typing, setTyping] = useState(false);
  const [pending, setPending] = useState<PendingAttachment[]>([]);
  const [mediaFilter, setMediaFilter] = useState<MediaFilter>("all");
  const [chatDeleted, setChatDeleted] = useState<"me" | "both" | null>(null);
  const [lightbox, setLightbox] = useState<{ items: LightboxMedia[]; index: number } | null>(null);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const realConversation =
    /^[0-9a-f]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(conversation.id);

  const isNewChat = initialConversation.id === "new" && messages.length === 0;
  const visibleMessages = messages.filter((message) => !message.deletedForMe);
  const mediaItems = useMemo(
    () =>
      visibleMessages
        .flatMap((message) =>
          (message.attachments ?? []).map((attachment) => ({
            ...attachment,
            messageId: message.id,
            mine: message.from === "me",
          })),
        )
        .filter((attachment) => {
          if (mediaFilter === "images") return attachment.type === "image";
          if (mediaFilter === "videos") return attachment.type === "video";
          if (mediaFilter === "urls") return attachment.type === "url";
          return true;
        }),
    [visibleMessages, mediaFilter],
  );
  const visualMediaItems = mediaItems.filter(
    (attachment) => attachment.type === "image" || attachment.type === "video",
  );

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, typing, mediaFilter]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [conversation.id]);

  async function startChat(person: Author) {
    try {
      const next = await createConversationWith(person.handle);
      setConversation(next);
      setMessages([]);
      setChatDeleted(null);
      window.history.replaceState({}, "", `/messages/${next.id}`);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    } catch (error) {
      if (!import.meta.env.DEV) {
        toast.error(error instanceof Error ? error.message : "Could not start chat");
        return;
      }
      setConversation({
        id: `local-${person.handle}`,
        person,
        preview: "Start a private conversation...",
        time: "now",
        messages: [],
      });
      setMessages([]);
      setChatDeleted(null);
      window.setTimeout(() => inputRef.current?.focus(), 50);
    }
  }

  function handleFiles(files: FileList | null) {
    const selected = Array.from(files ?? []);
    if (selected.length === 0) return;
    setPending((prev) => [
      ...prev,
      ...selected.map((file, index) => {
        const url = URL.createObjectURL(file);
        return {
          id: `pending-${Date.now()}-${index}`,
          type: file.type.startsWith("video/") ? ("video" as const) : ("image" as const),
          url,
          objectUrl: url,
          file,
          label: file.name,
        };
      }),
    ]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function removePending(id: string) {
    setPending((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target?.objectUrl) URL.revokeObjectURL(target.objectUrl);
      return prev.filter((item) => item.id !== id);
    });
  }

  async function send() {
    const body = value.trim();
    const urls = Array.from(body.matchAll(/https?:\/\/\S+/g)).map((match, index) => ({
      id: `url-${Date.now()}-${index}`,
      type: "url" as const,
      url: match[0],
      label: match[0].replace(/^https?:\/\//, "").replace(/\/$/, ""),
    }));
    if (!body && pending.length === 0) return;

    try {
      const uploaded = pending.length
        ? await uploadMultipleMedia(
            pending.map((attachment) => {
              const file = (attachment as PendingAttachment & { file?: File }).file;
              if (!file) throw new Error("Attachment file is unavailable");
              return file;
            }),
          )
        : [];
      const mediaAttachments = pending.map((item, index) => ({
        id: `media-${Date.now()}-${index}`,
        type: item.type,
        url: uploaded[index] ?? item.url,
        ...(item.label ? { label: item.label } : {}),
      }));
      const attachments = [...mediaAttachments, ...urls];
      const message =
        realConversation && !conversation.id.startsWith("local-")
          ? await sendMessage(conversation.id, body, attachments)
          : ({
              id: `local-${Date.now()}`,
              from: "me",
              body,
              time: "now",
              ...(attachments.length > 0 ? { attachments } : {}),
            } satisfies ChatMessage);
      setMessages((prev) => [...prev, message]);
      setValue("");
      pending.forEach((item) => item.objectUrl && URL.revokeObjectURL(item.objectUrl));
      setPending([]);
      setTyping(true);
      window.setTimeout(() => setTyping(false), 1200);
      inputRef.current?.focus();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Message could not be sent");
    }
  }

  async function deleteMessage(id: string, scope: "me" | "both") {
    const isPersisted = /^[0-9a-f]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(
      id,
    );
    if (isPersisted) {
      try {
        if (scope === "me") await deleteMessageForMe(id);
        else await deleteMessageForBoth(id);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Message could not be deleted");
        return;
      }
    }
    setMessages((prev) =>
      prev.map((message) =>
        message.id === id
          ? {
              ...message,
              body: scope === "both" ? "" : message.body,
              ...(scope === "both" ? { attachments: [] } : {}),
              ...(scope === "me" ? { deletedForMe: true } : {}),
              ...(scope === "both" ? { deletedForBoth: true } : {}),
            }
          : message,
      ),
    );
  }

  async function deleteAttachment(messageId: string, attachmentId: string, scope: "me" | "both") {
    const isPersisted = /^[0-9a-f]{8}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{4}-[0-9a-f-]{12}$/i.test(
      messageId,
    );
    if (isPersisted && scope === "both") {
      try {
        await deleteMessageAttachmentForBoth(messageId, attachmentId);
      } catch (error) {
        toast.error(error instanceof Error ? error.message : "Attachment could not be deleted");
        return;
      }
    }
    setMessages((prev) =>
      prev.map((message) =>
        message.id === messageId
          ? {
              ...message,
              attachments: (message.attachments ?? []).filter((item) => item.id !== attachmentId),
              body:
                scope === "both" && !message.body && (message.attachments ?? []).length <= 1
                  ? ""
                  : message.body,
            }
          : message,
      ),
    );
  }

  function openLightbox(items: LightboxMedia[], itemId: string) {
    const visualItems = items.filter((item) => item.type === "image" || item.type === "video");
    const index = visualItems.findIndex((item) => item.id === itemId);
    if (visualItems.length > 0) setLightbox({ items: visualItems, index: Math.max(0, index) });
  }

  if (chatDeleted) {
    return (
      <section className="grid min-h-[70vh] place-items-center px-6 text-center">
        <div>
          <p className="font-display text-lg font-bold">
            {chatDeleted === "both"
              ? "Conversation deleted for both parties"
              : "Conversation deleted"}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            This conversation was removed from your current view.
          </p>
          <Link to="/messages" className="mt-4 inline-block text-sm font-semibold text-signal">
            Back to messages
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="flex min-w-0 flex-col">
      <header className="sticky top-0 z-30 flex items-center gap-3 border-b border-border bg-background/85 px-3 py-3 backdrop-blur sm:px-4">
        <Link
          to="/messages"
          aria-label="Back to messages"
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface lg:hidden"
        >
          <ArrowLeft className="size-5" />
        </Link>
        <div className="relative shrink-0">
          <Avatar initials={conversation.person.initials} className="size-9" />
          {isOnline(conversation) && (
            <span
              aria-hidden
              className="absolute -bottom-0.5 -right-0.5 size-2.5 rounded-full border-2 border-background bg-signal"
            />
          )}
        </div>
        <div className="min-w-0 flex-1">
          <p className="flex min-w-0 items-center gap-1.5 truncate font-display text-sm font-bold">
            <span className="truncate">{conversation.person.name}</span>
            {conversation.person.verified && <BadgeCheck className="size-4 shrink-0 text-signal" />}
          </p>
          <p className="truncate text-xs text-muted-foreground">
            {isOnline(conversation) ? "Active now" : `@${conversation.person.handle}`}
          </p>
        </div>
        <button
          type="button"
          aria-label="Delete chat for me"
          onClick={() => setChatDeleted("me")}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-destructive"
        >
          <Trash2 className="size-5" />
        </button>
        <button
          type="button"
          aria-label="Delete chat for both parties"
          onClick={() => setChatDeleted("both")}
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface hover:text-destructive"
        >
          <Info className="size-5" />
        </button>
      </header>

      <div className="flex flex-wrap gap-1 border-b border-border px-4 py-2 sm:px-6">
        {(
          [
            ["all", "All media", Images],
            ["images", "Images", ImagePlus],
            ["videos", "Videos", Video],
            ["urls", "URLs", Link2],
          ] as const
        ).map(([key, label, Icon]) => (
          <button
            key={key}
            type="button"
            aria-pressed={mediaFilter === key}
            onClick={() => setMediaFilter(key)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-semibold transition-colors",
              mediaFilter === key
                ? "bg-surface-2 text-foreground"
                : "text-muted-foreground hover:bg-surface hover:text-foreground",
            )}
          >
            <Icon className="size-3.5" />
            {label}
          </button>
        ))}
      </div>

      {isNewChat ? <UserLookup onSelect={startChat} /> : null}

      {mediaFilter !== "all" ? (
        <MediaPanel
          items={mediaItems}
          onDelete={deleteAttachment}
          onOpen={(itemId) => openLightbox(visualMediaItems, itemId)}
        />
      ) : (
        <div className="flex flex-1 flex-col gap-1 px-4 py-5 sm:px-6">
          <div className="mx-auto mb-4 max-w-sm rounded-2xl bg-surface/60 px-4 py-3 text-center">
            <Avatar
              initials={conversation.person.initials}
              className="mx-auto mb-2 size-12 rounded-2xl text-base"
            />
            <p className="font-display text-sm font-bold">{conversation.person.name}</p>
            <p className="text-xs text-muted-foreground">
              @{conversation.person.handle} · this conversation is private
            </p>
          </div>

          {visibleMessages.map((message, i) => {
            const prev = visibleMessages[i - 1];
            const next = visibleMessages[i + 1];
            const startsGroup = !prev || prev.from !== message.from;
            const endsGroup = !next || next.from !== message.from;
            const mine = message.from === "me";
            return (
              <MessageBubble
                key={message.id}
                message={message}
                mine={mine}
                startsGroup={startsGroup}
                endsGroup={endsGroup}
                onDeleteMessage={deleteMessage}
                onDeleteAttachment={deleteAttachment}
                onOpenLightbox={(itemId) =>
                  openLightbox(
                    (message.attachments ?? []).map((attachment) => ({
                      ...attachment,
                      messageId: message.id,
                    })),
                    itemId,
                  )
                }
              />
            );
          })}

          {typing && (
            <div className="mt-3 flex items-center gap-1.5 self-start rounded-3xl rounded-bl-md bg-surface px-4 py-3">
              {[0, 1, 2].map((d) => (
                <span
                  key={d}
                  className="size-1.5 animate-bounce rounded-full bg-muted-foreground"
                  style={{ animationDelay: `${d * 120}ms` }}
                />
              ))}
              <span className="sr-only">{conversation.person.name} is typing</span>
            </div>
          )}
          <div ref={endRef} />
        </div>
      )}

      {lightbox ? (
        <MediaLightbox
          items={lightbox.items}
          index={lightbox.index}
          onClose={() => setLightbox(null)}
          onIndexChange={(index) =>
            setLightbox((current) => (current ? { ...current, index } : current))
          }
        />
      ) : null}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send();
        }}
        className="sticky bottom-16 z-30 border-t border-border bg-background/95 px-3 py-3 backdrop-blur sm:px-4 md:bottom-0"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*,video/*"
          multiple
          className="hidden"
          onChange={(event) => handleFiles(event.target.files)}
        />
        {pending.length > 0 && (
          <div className="mb-2 flex gap-2 overflow-x-auto px-2 pb-1">
            {pending.map((item) => (
              <div
                key={item.id}
                className="relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border border-border bg-surface"
              >
                {item.type === "video" ? (
                  <video src={item.url} muted className="size-full object-cover" />
                ) : (
                  <img
                    src={item.url}
                    alt={item.label ?? "Pending image"}
                    className="size-full object-cover"
                  />
                )}
                <button
                  type="button"
                  aria-label={`Remove ${item.label ?? "attachment"}`}
                  onClick={() => removePending(item.id)}
                  className="absolute right-1 top-1 grid size-6 place-items-center rounded-full bg-background/85"
                >
                  <X className="size-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
        <div className="flex items-end gap-2 rounded-3xl bg-surface px-2 py-1.5">
          <button
            type="button"
            aria-label="Add media"
            onClick={() => fileInputRef.current?.click()}
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <ImagePlus className="size-4" />
          </button>
          <label htmlFor="dm" className="sr-only">
            Message {conversation.person.name}
          </label>
          <textarea
            id="dm"
            ref={inputRef}
            rows={1}
            value={value}
            maxLength={1000}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void send();
              }
            }}
            placeholder="Start a message"
            className="max-h-32 min-w-0 flex-1 resize-none bg-transparent py-2 text-sm leading-relaxed placeholder:text-muted-foreground focus:outline-none"
          />
          <button
            type="button"
            aria-label="Add emoji"
            className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground"
          >
            <Smile className="size-4" />
          </button>
          <Button
            type="submit"
            disabled={!value.trim() && pending.length === 0}
            size="icon"
            className="size-9 shrink-0 rounded-full"
            aria-label="Send message"
          >
            <Send className="size-4" />
          </Button>
        </div>
        <p className="mt-1.5 px-2 text-[10px] text-muted-foreground">
          Enter to send · Shift + Enter for a new line
        </p>
      </form>
    </section>
  );
}

function UserLookup({ onSelect }: { onSelect: (person: Author) => void }) {
  const [query, setQuery] = useState("");
  const [profiles, setProfiles] = useState<Author[]>([]);
  useEffect(() => {
    let active = true;
    searchProfiles(query)
      .then((items) => {
        if (!active) return;
        setProfiles(items);
      })
      .catch(() => {
        if (!active) return;
        setProfiles([]);
      });
    return () => {
      active = false;
    };
  }, [query]);

  const results = profiles.filter((person) => {
    const term = query.trim().toLowerCase();
    if (!term) return true;
    return person.name.toLowerCase().includes(term) || person.handle.toLowerCase().includes(term);
  });

  return (
    <div className="border-b border-border px-4 py-4 sm:px-6">
      <div className="flex items-center gap-2 rounded-full bg-surface px-3.5 py-2">
        <Search className="size-4 shrink-0 text-muted-foreground" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Look up a user"
          aria-label="Look up a user"
          className="min-w-0 flex-1 bg-transparent text-sm placeholder:text-muted-foreground focus:outline-none"
        />
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        {results.map((person) => (
          <button
            key={person.handle}
            type="button"
            onClick={() => void onSelect(person)}
            className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 rounded-xl border border-border p-3 text-left transition-colors hover:bg-surface"
          >
            <Avatar initials={person.initials} className="size-10" />
            <span className="min-w-0">
              <span className="block truncate font-display text-sm font-bold">{person.name}</span>
              <span className="block truncate text-xs text-muted-foreground">@{person.handle}</span>
            </span>
            <UserPlus className="size-4 text-muted-foreground" />
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  mine,
  startsGroup,
  endsGroup,
  onDeleteMessage,
  onDeleteAttachment,
  onOpenLightbox,
}: {
  message: ChatMessage;
  mine: boolean;
  startsGroup: boolean;
  endsGroup: boolean;
  onDeleteMessage: (id: string, scope: "me" | "both") => void;
  onDeleteAttachment: (messageId: string, attachmentId: string, scope: "me" | "both") => void;
  onOpenLightbox: (attachmentId: string) => void;
}) {
  if (message.deletedForBoth) {
    return (
      <div className={cn("my-1 max-w-[85%] sm:max-w-[70%]", mine ? "self-end" : "self-start")}>
        <div className="rounded-3xl border border-dashed border-border px-4 py-2.5 text-sm text-muted-foreground">
          Message deleted
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "group flex max-w-[85%] flex-col sm:max-w-[70%]",
        mine ? "self-end items-end" : "self-start items-start",
        startsGroup && "mt-3",
      )}
    >
      <div
        className={cn(
          "rounded-3xl px-4 py-2.5 text-sm leading-relaxed break-words",
          mine ? "bg-primary text-primary-foreground" : "bg-surface text-foreground",
          mine && !startsGroup && "rounded-tr-md",
          mine && !endsGroup && "rounded-br-md",
          !mine && !startsGroup && "rounded-tl-md",
          !mine && !endsGroup && "rounded-bl-md",
        )}
      >
        {message.body ? <p>{message.body}</p> : null}
        {message.attachments?.length ? (
          <AttachmentGrid
            messageId={message.id}
            attachments={message.attachments}
            mine={mine}
            onDeleteAttachment={onDeleteAttachment}
            onOpenLightbox={onOpenLightbox}
          />
        ) : null}
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-2 px-1 text-[10px] text-muted-foreground">
        {endsGroup ? (
          <span>
            {message.time}
            {mine ? " · Sent" : ""}
          </span>
        ) : null}
        <button
          type="button"
          onClick={() => onDeleteMessage(message.id, "me")}
          className="hover:text-destructive"
        >
          Delete for me
        </button>
        <button
          type="button"
          onClick={() => onDeleteMessage(message.id, "both")}
          className="hover:text-destructive"
        >
          Delete for both
        </button>
      </div>
    </div>
  );
}

function AttachmentGrid({
  messageId,
  attachments,
  mine,
  onDeleteAttachment,
  onOpenLightbox,
}: {
  messageId: string;
  attachments: ChatAttachment[];
  mine: boolean;
  onDeleteAttachment: (messageId: string, attachmentId: string, scope: "me" | "both") => void;
  onOpenLightbox: (attachmentId: string) => void;
}) {
  return (
    <div className={cn("mt-2 grid gap-1.5", attachments.length > 1 && "grid-cols-2")}>
      {attachments.map((attachment) => (
        <div key={attachment.id} className="overflow-hidden rounded-2xl bg-background/20">
          {attachment.type === "image" ? (
            <button
              type="button"
              onClick={() => onOpenLightbox(attachment.id)}
              className="block w-full overflow-hidden text-left"
            >
              <img
                src={attachment.url}
                alt={attachment.label ?? "Message image"}
                className="aspect-[4/3] w-full object-cover transition-transform hover:scale-105"
              />
            </button>
          ) : attachment.type === "video" ? (
            <button
              type="button"
              onClick={() => onOpenLightbox(attachment.id)}
              className="block w-full overflow-hidden text-left"
            >
              <video
                src={attachment.url}
                muted
                preload="metadata"
                className="aspect-video w-full bg-black object-cover"
              />
              <span className="sr-only">Open video {attachment.label ?? attachment.id}</span>
            </button>
          ) : (
            <a
              href={attachment.url}
              target="_blank"
              rel="noreferrer"
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-xs underline-offset-2 hover:underline",
                mine ? "text-primary-foreground" : "text-signal",
              )}
            >
              <Link2 className="size-3.5" />
              <span className="truncate">{attachment.label ?? attachment.url}</span>
            </a>
          )}
          <div className="flex gap-2 px-2 py-1 text-[10px]">
            <button
              type="button"
              onClick={() => onDeleteAttachment(messageId, attachment.id, "me")}
              className="text-muted-foreground hover:text-destructive"
            >
              Delete media for me
            </button>
            <button
              type="button"
              onClick={() => onDeleteAttachment(messageId, attachment.id, "both")}
              className="text-muted-foreground hover:text-destructive"
            >
              Delete media for both
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

function MediaPanel({
  items,
  onDelete,
  onOpen,
}: {
  items: Array<ChatAttachment & { messageId: string; mine: boolean }>;
  onDelete: (messageId: string, attachmentId: string, scope: "me" | "both") => void;
  onOpen: (attachmentId: string) => void;
}) {
  return (
    <div className="grid gap-3 px-4 py-5 sm:grid-cols-2 sm:px-6 xl:grid-cols-3">
      {items.length === 0 ? (
        <p className="col-span-full py-10 text-center text-sm text-muted-foreground">
          No media in this tab yet.
        </p>
      ) : (
        items.map((item) => (
          <div
            key={`${item.messageId}-${item.id}`}
            className="overflow-hidden rounded-xl border border-border bg-surface"
          >
            {item.type === "image" ? (
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="block w-full overflow-hidden text-left"
              >
                <img
                  src={item.url}
                  alt={item.label ?? "Shared image"}
                  className="aspect-[4/3] w-full object-cover transition-transform hover:scale-105"
                />
              </button>
            ) : item.type === "video" ? (
              <button
                type="button"
                onClick={() => onOpen(item.id)}
                className="block w-full overflow-hidden text-left"
              >
                <video
                  src={item.url}
                  muted
                  preload="metadata"
                  className="aspect-video w-full bg-black object-cover"
                />
                <span className="sr-only">Open video {item.label ?? item.id}</span>
              </button>
            ) : (
              <a
                href={item.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-2 px-3 py-4 text-sm font-semibold text-signal underline-offset-2 hover:underline"
              >
                <Link2 className="size-4" />
                <span className="truncate">{item.label ?? item.url}</span>
              </a>
            )}
            <div className="flex flex-wrap gap-2 px-3 py-2 text-xs">
              <button
                type="button"
                onClick={() => onDelete(item.messageId, item.id, "me")}
                className="text-muted-foreground hover:text-destructive"
              >
                Delete for me
              </button>
              <button
                type="button"
                onClick={() => onDelete(item.messageId, item.id, "both")}
                className="text-muted-foreground hover:text-destructive"
              >
                Delete for both
              </button>
            </div>
          </div>
        ))
      )}
    </div>
  );
}

function MediaLightbox({
  items,
  index,
  onClose,
  onIndexChange,
}: {
  items: LightboxMedia[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const current = items[index];
  const hasMultiple = items.length > 1;

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft" && hasMultiple) {
        onIndexChange((index - 1 + items.length) % items.length);
      }
      if (event.key === "ArrowRight" && hasMultiple) {
        onIndexChange((index + 1) % items.length);
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [hasMultiple, index, items.length, onClose, onIndexChange]);

  if (!current) return null;

  const previous = () => onIndexChange((index - 1 + items.length) % items.length);
  const next = () => onIndexChange((index + 1) % items.length);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Message media viewer"
      className="fixed inset-0 z-50 grid grid-rows-[auto_minmax(0,1fr)_auto] bg-background/95 p-3 backdrop-blur sm:p-5"
      onClick={onClose}
    >
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-display text-sm font-bold">
            {current.label ?? (current.type === "video" ? "Shared video" : "Shared image")}
          </p>
          <p className="text-xs tabular-nums text-muted-foreground">
            {index + 1} / {items.length}
          </p>
        </div>
        <button
          type="button"
          aria-label="Close media viewer"
          onClick={onClose}
          className="grid size-10 shrink-0 place-items-center rounded-full bg-surface text-foreground hover:bg-surface-2"
        >
          <X className="size-5" />
        </button>
      </div>

      <div
        className="relative grid min-h-0 place-items-center py-4"
        onClick={(event) => event.stopPropagation()}
      >
        {current.type === "image" ? (
          <img
            src={current.url}
            alt={current.label ?? "Shared image"}
            className="max-h-full max-w-full rounded-2xl object-contain shadow-2xl"
          />
        ) : (
          <video
            src={current.url}
            controls
            autoPlay
            className="max-h-full max-w-full rounded-2xl bg-black shadow-2xl"
          />
        )}

        {hasMultiple ? (
          <>
            <button
              type="button"
              aria-label="Previous media"
              onClick={previous}
              className="absolute left-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-foreground shadow-lift hover:bg-surface sm:left-4"
            >
              <ChevronLeft className="size-5" />
            </button>
            <button
              type="button"
              aria-label="Next media"
              onClick={next}
              className="absolute right-1 top-1/2 grid size-11 -translate-y-1/2 place-items-center rounded-full bg-surface/90 text-foreground shadow-lift hover:bg-surface sm:right-4"
            >
              <ChevronRight className="size-5" />
            </button>
          </>
        ) : null}
      </div>

      {hasMultiple ? (
        <div className="mx-auto flex max-w-full gap-2 overflow-x-auto pb-1">
          {items.map((item, itemIndex) => (
            <button
              key={`${item.id}-${itemIndex}`}
              type="button"
              aria-label={`Open media ${itemIndex + 1}`}
              aria-current={itemIndex === index}
              onClick={(event) => {
                event.stopPropagation();
                onIndexChange(itemIndex);
              }}
              className={cn(
                "h-14 w-20 shrink-0 overflow-hidden rounded-lg border bg-surface",
                itemIndex === index
                  ? "border-signal"
                  : "border-border opacity-70 hover:opacity-100",
              )}
            >
              {item.type === "image" ? (
                <img src={item.url} alt="" className="size-full object-cover" />
              ) : (
                <video src={item.url} muted preload="metadata" className="size-full object-cover" />
              )}
            </button>
          ))}
        </div>
      ) : (
        <span />
      )}
    </div>
  );
}
