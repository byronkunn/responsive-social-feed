import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Bell, Lock, Palette, UserCog } from "lucide-react";
import { toast } from "sonner";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { Avatar } from "@/components/pulse/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { useHideLikes } from "@/hooks/use-preferences";
import { useProfile } from "@/hooks/use-session";
import { supabase } from "@/integrations/supabase/client";
import { currentUser } from "@/lib/pulse-data";
import { requireClientSession } from "@/lib/require-auth";

export const Route = createFileRoute("/settings/")({
  beforeLoad: requireClientSession,
  head: () => ({
    meta: [
      { title: "Settings — your Pulse account" },
      {
        name: "description",
        content: "Manage your Pulse profile, notification preferences, appearance and privacy.",
      },
      { property: "og:title", content: "Settings — your Pulse account" },
      {
        property: "og:description",
        content: "Manage your Pulse profile, notification preferences, appearance and privacy.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SettingsPage,
});

const sections = ["Account", "Notifications", "Appearance", "Privacy"] as const;
type Section = (typeof sections)[number];

const icons: Record<Section, React.ElementType> = {
  Account: UserCog,
  Notifications: Bell,
  Appearance: Palette,
  Privacy: Lock,
};

const toggles: Record<
  Exclude<Section, "Account">,
  { key: string; label: string; hint: string; on: boolean }[]
> = {
  Notifications: [
    { key: "sparks", label: "Sparks", hint: "When someone sparks your pulse", on: true },
    { key: "echoes", label: "Echoes", hint: "When your pulse gets echoed", on: true },
    { key: "replies", label: "Replies", hint: "Every reply in your threads", on: false },
    { key: "digest", label: "Weekly digest", hint: "A Sunday summary by email", on: false },
  ],
  Appearance: [
    { key: "dim", label: "Dim images", hint: "Soften media until you tap it", on: false },
    { key: "motion", label: "Reduce motion", hint: "Cut animated transitions", on: false },
    { key: "compact", label: "Compact feed", hint: "Tighter spacing between pulses", on: true },
  ],
  Privacy: [
    {
      key: "hide-likes",
      label: "Hide your likes",
      hint: "Keep your Likes tab private to you",
      on: false,
    },
    {
      key: "protected",
      label: "Protected pulses",
      hint: "Only approved followers can read",
      on: false,
    },
    { key: "dms", label: "Open DMs", hint: "Let anyone start a conversation", on: true },
    {
      key: "discover",
      label: "Discoverable by email",
      hint: "Let people find you by address",
      on: false,
    },
  ],
};

function SettingsPage() {
  const [section, setSection] = useState<Section>("Account");
  const { hideLikes, setHideLikes } = useHideLikes();
  const { profile, setProfile, user, loading } = useProfile();
  const [name, setName] = useState(currentUser.name);
  const [handle, setHandle] = useState(currentUser.handle);
  const [bio, setBio] = useState(
    "Building small tools with sharp edges. Interested in local-first software, typography, and the North Sea.",
  );
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      Object.values(toggles)
        .flat()
        .map((t) => [t.key, t.on]),
    ),
  );

  useEffect(() => {
    if (!profile) return;
    setName(profile.display_name);
    setHandle(profile.handle);
    setBio(profile.bio);
  }, [profile]);

  const initials = (profile?.initials ?? currentUser.initials).slice(0, 2).toUpperCase();
  const email = user?.email ?? "";

  async function saveAccount() {
    if (!profile) {
      toast.error("Your profile is still loading. Try again.");
      return;
    }

    const displayName = name.trim();
    const normalizedHandle = handle.trim().toLowerCase();
    const nextBio = bio.trim();

    if (!displayName) {
      toast.error("Display name is required");
      return;
    }

    if (!normalizedHandle || !/^[a-z0-9_]{1,30}$/.test(normalizedHandle)) {
      toast.error("Handle must use letters, numbers, or underscores");
      return;
    }

    const nextProfile = {
      ...profile,
      display_name: displayName,
      handle: normalizedHandle,
      bio: nextBio,
      initials: displayName.slice(0, 2).toUpperCase(),
    };

    if (profile.id.startsWith("local-")) {
      localStorage.setItem("pulse_local_user", JSON.stringify(nextProfile));
      setProfile(nextProfile);
      toast.success("Account details updated");
      return;
    }

    setBusy(true);
    const { error } = await supabase
      .from("profiles")
      .update({
        display_name: displayName,
        handle: normalizedHandle,
        bio: nextBio,
        initials: displayName.slice(0, 2).toUpperCase(),
      })
      .eq("id", profile.id);
    setBusy(false);

    if (error) {
      toast.error(error.message);
      return;
    }

    setProfile(nextProfile);
    toast.success("Account details updated");
  }

  return (
    <AppShell rail={false}>
      <TopBar title="Settings" subtitle="Tune Pulse to your liking" />

      <div className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-0 lg:grid-cols-[220px_minmax(0,1fr)]">
        <nav className="min-w-0 overflow-hidden border-b border-border lg:overflow-visible lg:border-b-0 lg:border-r">
          <ul className="flex overflow-x-auto p-2 lg:flex-col lg:overflow-visible lg:p-3">
            {sections.map((s) => {
              const Icon = icons[s];
              return (
                <li key={s} className="shrink-0 lg:w-full">
                  <button
                    type="button"
                    onClick={() => setSection(s)}
                    className={`flex w-full items-center gap-2.5 rounded-2xl px-3 py-2.5 text-left font-display text-sm font-semibold transition-colors ${
                      section === s
                        ? "bg-surface-2 text-foreground"
                        : "text-muted-foreground hover:bg-surface"
                    }`}
                  >
                    <Icon className="size-4 shrink-0" />
                    {s}
                  </button>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="min-w-0 p-4 sm:p-6">
          {section === "Account" ? (
            <div className="space-y-5">
              <div className="flex items-center gap-3">
                <Avatar initials={initials} className="size-14 text-base" />
                <div className="min-w-0">
                  <p className="truncate font-display text-base font-bold">{name}</p>
                  <p className="truncate text-sm text-muted-foreground">@{handle}</p>
                </div>
              </div>

              <Field label="Display name" value={name} onChange={setName} />
              <Field
                label="Handle"
                value={handle}
                onChange={(value) => setHandle(value.replace(/[^a-zA-Z0-9_]/g, ""))}
              />
              <Field label="Email" value={email} type="email" readOnly />
              <div>
                <label htmlFor="bio" className="font-display text-sm font-semibold">
                  Bio
                </label>
                <textarea
                  id="bio"
                  rows={3}
                  maxLength={160}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  className="mt-1.5 w-full resize-none rounded-2xl bg-surface px-4 py-3 text-sm leading-relaxed focus:outline-none focus:ring-1 focus:ring-signal"
                />
                <p className="mt-1 text-right text-xs text-muted-foreground">
                  {160 - bio.length} left
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <Button
                  className="rounded-full font-display font-bold"
                  onClick={saveAccount}
                  disabled={busy || loading}
                >
                  Save changes
                </Button>
                <Button variant="secondary" asChild className="rounded-full font-semibold">
                  <Link to="/profile/edit">Edit full profile</Link>
                </Button>
                <Button variant="ghost" asChild className="rounded-full font-semibold">
                  <Link to="/settings/security">Password & account</Link>
                </Button>
              </div>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {toggles[section].map((t) => (
                <li key={t.key} className="flex items-center justify-between gap-4 py-4">
                  <div className="min-w-0">
                    <p className="font-display text-sm font-semibold">{t.label}</p>
                    <p className="text-xs leading-relaxed text-muted-foreground">{t.hint}</p>
                  </div>
                  <Switch
                    checked={t.key === "hide-likes" ? hideLikes : (state[t.key] ?? false)}
                    onCheckedChange={(v) =>
                      t.key === "hide-likes"
                        ? setHideLikes(v)
                        : setState((prev) => ({ ...prev, [t.key]: v }))
                    }
                    aria-label={t.label}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AppShell>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
  readOnly = false,
}: {
  label: string;
  value: string;
  onChange?: (value: string) => void;
  type?: string;
  readOnly?: boolean;
}) {
  const id = label.toLowerCase().replace(/\s+/g, "-");
  return (
    <div>
      <label htmlFor={id} className="font-display text-sm font-semibold">
        {label}
      </label>
      <Input
        id={id}
        type={type}
        value={value}
        readOnly={readOnly}
        onChange={(e) => onChange?.(e.target.value)}
        className="mt-1.5"
      />
    </div>
  );
}
