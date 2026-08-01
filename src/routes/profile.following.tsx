import { createFileRoute } from "@tanstack/react-router";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { ConnectionList, ConnectionTabs } from "@/components/pulse/connection-list";
import { useProfile } from "@/hooks/use-session";
import { currentUser, following } from "@/lib/pulse-data";
import { requireClientSession } from "@/lib/require-auth";

export const Route = createFileRoute("/profile/following")({
  beforeLoad: requireClientSession,
  head: () => ({
    meta: [
      { title: "Following — Pulse" },
      { name: "description", content: "Everyone this account follows on Pulse." },
      { property: "og:title", content: "Following — Pulse" },
      { property: "og:description", content: "Everyone this account follows on Pulse." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FollowingPage,
});

function FollowingPage() {
  const { profile } = useProfile();
  const name = profile?.display_name ?? currentUser.name;
  const handle = profile?.handle ?? currentUser.handle;

  return (
    <AppShell rail={false}>
      <TopBar title={name} subtitle={`@${handle}`} />
      <ConnectionTabs active="following" />
      <ConnectionList people={following} />
    </AppShell>
  );
}
