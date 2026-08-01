import { createFileRoute } from "@tanstack/react-router";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { ConversationList, NewMessageButton } from "@/components/pulse/conversation-list";
import { conversations } from "@/lib/pulse-data";

export const Route = createFileRoute("/messages/")({
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
  const unread = conversations.reduce((n, c) => n + (c.unread ?? 0), 0);

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
      <ConversationList />
      <div className="hidden px-6 py-12 text-center lg:block">
        <p className="text-sm text-muted-foreground">
          Pick a conversation to open it beside your inbox.
        </p>
      </div>
      <NewMessageButton />
    </AppShell>
  );
}
