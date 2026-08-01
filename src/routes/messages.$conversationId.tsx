import { useEffect, useRef, useState } from "react";
import { createFileRoute, Link, notFound } from "@tanstack/react-router";
import { ArrowLeft, BadgeCheck, ImagePlus, Info, Send, Smile } from "lucide-react";
import { AppShell } from "@/components/pulse/app-shell";
import { Avatar } from "@/components/pulse/avatar";
import { ConversationList, isOnline } from "@/components/pulse/conversation-list";
import { Button } from "@/components/ui/button";
import { conversationById, type ChatMessage } from "@/lib/pulse-data";
import { requireClientSession } from "@/lib/require-auth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/messages/$conversationId")({
  beforeLoad: requireClientSession,
  loader: ({ params }) => {
    const existing = conversationById(params.conversationId);
    const conversation = existing ?? {
      id: params.conversationId,
      person: {
        name: params.conversationId === "new" ? "New Message" : params.conversationId,
        handle: params.conversationId === "new" ? "new" : params.conversationId,
        initials:
          params.conversationId === "new" ? "DM" : params.conversationId.slice(0, 2).toUpperCase(),
      },
      preview: "Start a private conversation...",
      time: "now",
      messages: [],
    };
    return { conversation };
  },
  head: ({ loaderData }) => {
    if (!loaderData) {
      return {
        meta: [{ title: "Conversation not found — Pulse" }, { name: "robots", content: "noindex" }],
      };
    }
    const title = `Chat with ${loaderData.conversation.person.name} — Pulse`;
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
  notFoundComponent: () => (
    <AppShell rail={false}>
      <div className="px-6 py-16 text-center">
        <p className="font-display text-lg font-bold">Conversation not found</p>
        <Link to="/messages" className="mt-2 inline-block text-sm text-signal hover:underline">
          Back to messages
        </Link>
      </div>
    </AppShell>
  ),
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
        <Thread key={conversation.id} />
      </div>
    </AppShell>
  );
}

function Thread() {
  const { conversation } = Route.useLoaderData();
  const [messages, setMessages] = useState<ChatMessage[]>(conversation.messages);
  const [value, setValue] = useState("");
  const [typing, setTyping] = useState(false);
  const endRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages, typing]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function send() {
    const body = value.trim();
    if (!body) return;
    setMessages((prev) => [...prev, { id: `local-${prev.length}`, from: "me", body, time: "now" }]);
    setValue("");
    setTyping(true);
    window.setTimeout(() => setTyping(false), 1800);
    inputRef.current?.focus();
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
          aria-label="Conversation info"
          className="grid size-9 shrink-0 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-surface"
        >
          <Info className="size-5" />
        </button>
      </header>

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

        {messages.map((m, i) => {
          const prev = messages[i - 1];
          const next = messages[i + 1];
          const startsGroup = !prev || prev.from !== m.from;
          const endsGroup = !next || next.from !== m.from;
          const mine = m.from === "me";
          return (
            <div
              key={m.id}
              className={cn(
                "flex max-w-[85%] flex-col sm:max-w-[70%]",
                mine ? "self-end items-end" : "self-start items-start",
                startsGroup && i > 0 && "mt-3",
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
                {m.body}
              </div>
              {endsGroup && (
                <span className="mt-1 px-1 text-[10px] text-muted-foreground">
                  {m.time}
                  {mine ? " · Sent" : ""}
                </span>
              )}
            </div>
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

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send();
        }}
        className="sticky bottom-16 z-30 border-t border-border bg-background/95 px-3 py-3 backdrop-blur sm:px-4 md:bottom-0"
      >
        <div className="flex items-end gap-2 rounded-3xl bg-surface px-2 py-1.5">
          <button
            type="button"
            aria-label="Add image"
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
                send();
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
            disabled={!value.trim()}
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
