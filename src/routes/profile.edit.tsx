import { useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { toast } from "sonner";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { Avatar } from "@/components/pulse/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { currentUser } from "@/lib/pulse-data";
import { requireClientSession } from "@/lib/require-auth";

export const Route = createFileRoute("/profile/edit")({
  beforeLoad: requireClientSession,
  head: () => ({
    meta: [
      { title: "Edit your Pulse profile" },
      {
        name: "description",
        content: "Update your display name, handle, bio and header on Pulse.",
      },
      { property: "og:title", content: "Edit your Pulse profile" },
      {
        property: "og:description",
        content: "Update your display name, handle, bio and header on Pulse.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: EditProfile,
});

function EditProfile() {
  const { profile, setProfile, loading } = useProfile();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [handle, setHandle] = useState("");
  const [bio, setBio] = useState("");
  const [busy, setBusy] = useState(false);

  const displayName = name || profile?.display_name || currentUser.name;
  const displayHandle = handle || profile?.handle || currentUser.handle;
  const displayBio =
    bio ||
    profile?.bio ||
    "Building small tools with sharp edges. Interested in local-first software, typography, and the North Sea.";
  const initials = (profile?.initials || currentUser.initials).slice(0, 2).toUpperCase();

  async function save() {
    if (!profile) {
      toast.error("Your profile is still loading. Try again.");
      return;
    }
    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName.trim(),
        handle: displayHandle.trim().toLowerCase(),
        bio: displayBio.trim(),
        initials: displayName.trim().slice(0, 2).toUpperCase(),
      })
      .eq("id", profile.id);
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Profile updated");
    setProfile({
      ...profile,
      display_name: displayName.trim(),
      handle: displayHandle.trim().toLowerCase(),
      bio: displayBio.trim(),
      initials: displayName.trim().slice(0, 2).toUpperCase(),
    });
    navigate({ to: "/profile" });
  }

  return (
    <AppShell rail={false}>
      <TopBar title="Edit profile" subtitle="How you show up on Pulse" />
      <div className="h-28 gradient-signal sm:h-36" />
      <div className="px-4 pb-10 sm:px-6">
        <Avatar
          initials={initials}
          className="-mt-10 size-20 rounded-3xl text-xl ring-4 ring-background sm:-mt-12 sm:size-24"
        />
        <div className="mt-5 max-w-lg space-y-5">
          <div className="space-y-1.5">
            <Label htmlFor="name">Display name</Label>
            <Input
              id="name"
              maxLength={50}
              value={displayName}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="handle">Handle</Label>
            <div className="flex items-center gap-2">
              <span className="text-muted-foreground">@</span>
              <Input
                id="handle"
                maxLength={30}
                value={displayHandle}
                onChange={(e) => setHandle(e.target.value.replace(/[^a-zA-Z0-9_]/g, ""))}
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="bio">Bio</Label>
            <textarea
              id="bio"
              rows={4}
              maxLength={160}
              value={displayBio}
              onChange={(e) => setBio(e.target.value)}
              className="w-full resize-none rounded-2xl border border-border bg-transparent px-3 py-2 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-ring"
            />
            <p className="text-right text-xs text-muted-foreground">
              {160 - displayBio.length} left
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={save}
              disabled={busy || loading}
              className="rounded-full font-display font-bold"
            >
              Save changes
            </Button>
            <Button
              variant="secondary"
              className="rounded-full font-display font-bold"
              onClick={() => navigate({ to: "/profile" })}
            >
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
