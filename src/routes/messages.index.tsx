import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { ConversationList, NewMessageButton } from "@/components/pulse/conversation-list";
import { conversations as seedConversations, type Conversation } from "@/lib/pulse-data";
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
  const [conversations, setConversations] = useState<Conversation[]>(
    import.meta.env.DEV ? seedConversations : [],
  );
  const unread = conversations.reduce((n, c) => n + (c.unread ?? 0), 0);

  useEffect(() => {
    let active = true;
    fetchConversations()
      .then((fetched) => {
        if (!active) return;
        setConversations(
          fetched.length > 0 ? fetched : import.meta.env.DEV ? seedConversations : [],
        );
      })
      .catch(() => {
        if (!active) return;
        setConversations(import.meta.env.DEV ? seedConversations : []);
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
      <div className="hidden px-6 py-12 text-center lg:block">
        <p className="text-sm text-muted-foreground">
          Pick a conversation to open it beside your inbox.
        </p>
      </div>
      <NewMessageButton />
    </AppShell>
  );
}
