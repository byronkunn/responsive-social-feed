import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { ConversationList, NewMessageButton } from "@/components/pulse/conversation-list";
import { type Conversation } from "@/lib/pulse-data";
import { requireClientSession } from "@/lib/require-auth";
import { fetchConversations } from "@/lib/social-api";

export const Route = createFileRoute("/messages/")({
  beforeLoad: requireClientSession,
  head: () => ({
    meta: [
      { title: "Messages — Pulse" },
      {
        name: "description",
        content: "Private conversations with the people you follow on Pulse.",
      },
      { property: "og:title", content: "Messages — Pulse" },
      {
        property: "og:description",
        content: "Private conversations with the people you follow on Pulse.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: Messages,
});

function Messages() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loadError, setLoadError] = useState(false);
  const unread = conversations.reduce((n, c) => n + (c.unread ?? 0), 0);

  useEffect(() => {
    let active = true;
    fetchConversations()
      .then((fetched) => {
        if (!active) return;
        setConversations(fetched);
        setLoadError(false);
      })
      .catch(() => {
        if (!active) return;
        setConversations([]);
        setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell rail={false}>
      <TopBar
        title="Messages"
        subtitle={
          unread
            ? `${conversations.length} conversations · ${unread} unread`
            : `${conversations.length} conversations`
        }
      />
      <ConversationList items={conversations} />
      {loadError ? (
        <p className="border-b border-border bg-surface/50 px-6 py-3 text-sm text-muted-foreground">
          Live conversations are unavailable. Apply the Supabase migrations to load messages.
        </p>
      ) : null}
      <div className="hidden px-6 py-12 text-center lg:block">
        <p className="text-sm text-muted-foreground">
          Pick a conversation to open it beside your inbox.
        </p>
      </div>
      <NewMessageButton />
    </AppShell>
  );
}
