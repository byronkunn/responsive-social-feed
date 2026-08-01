import { useEffect, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { ConnectionList, ConnectionTabs } from "@/components/pulse/connection-list";
import { useProfile } from "@/hooks/use-session";
import { currentUser, type Connection } from "@/lib/pulse-data";
import { requireClientSession } from "@/lib/require-auth";
import { fetchConnections } from "@/lib/social-api";

export const Route = createFileRoute("/profile/followers")({
  beforeLoad: requireClientSession,
  head: () => ({
    meta: [
      { title: "Followers — Pulse" },
      { name: "description", content: "The people following this account on Pulse." },
      { property: "og:title", content: "Followers — Pulse" },
      { property: "og:description", content: "The people following this account on Pulse." },
      { property: "og:type", content: "profile" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: FollowersPage,
});

function FollowersPage() {
  const { profile } = useProfile();
  const [followers, setFollowers] = useState<Connection[]>([]);
  const name = profile?.display_name ?? currentUser.name;
  const handle = profile?.handle ?? currentUser.handle;

  useEffect(() => {
    let active = true;
    fetchConnections("followers")
      .then((items) => {
        if (active) setFollowers(items);
      })
      .catch(() => {
        if (active) setFollowers([]);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <AppShell rail={false}>
      <TopBar title={name} subtitle={`@${handle}`} />
      <ConnectionTabs active="followers" />
      <ConnectionList people={followers} />
    </AppShell>
  );
}
