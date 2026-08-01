import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { BadgeCheck } from "lucide-react";
import { Avatar } from "./avatar";
import { Button } from "@/components/ui/button";
import { toggleFollowProfile } from "@/lib/social-api";
import type { Connection } from "@/lib/pulse-data";
import { toast } from "sonner";

export function ConnectionTabs({ active }: { active: "followers" | "following" }) {
  const tabs = [
    { key: "followers", label: "Followers", to: "/profile/followers" },
    { key: "following", label: "Following", to: "/profile/following" },
  ] as const;

  return (
    <div className="grid grid-cols-2 border-b border-border">
      {tabs.map((t) => (
        <Link
          key={t.key}
          to={t.to}
          className={`py-3.5 text-center font-display text-sm font-bold transition-colors ${
            active === t.key
              ? "border-b-2 border-signal text-foreground"
              : "text-muted-foreground hover:bg-surface/60"
          }`}
        >
          {t.label}
        </Link>
      ))}
    </div>
  );
}

export function ConnectionList({ people }: { people: Connection[] }) {
  if (people.length === 0) {
    return (
      <p className="px-6 py-16 text-center text-sm text-muted-foreground">
        No accounts to display here yet.
      </p>
    );
  }

  return (
    <ul>
      {people.map((p) => (
        <ConnectionRow key={p.handle} person={p} />
      ))}
    </ul>
  );
}

function ConnectionRow({ person }: { person: Connection }) {
  const [following, setFollowing] = useState(Boolean(person.follows));

  async function toggle() {
    const previous = following;
    setFollowing(!previous);
    try {
      await toggleFollowProfile(person.handle, previous);
      toast.success(previous ? `Unfollowed @${person.handle}` : `Following @${person.handle}`);
    } catch (error) {
      setFollowing(previous);
      toast.error(error instanceof Error ? error.message : "Follow update failed");
    }
  }

  return (
    <li className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-3 border-b border-border px-4 py-4 transition-colors hover:bg-surface/60 sm:px-6">
      <Avatar initials={person.initials} />
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-center gap-x-1.5">
          <span className="truncate font-display text-sm font-bold">{person.name}</span>
          {person.verified && (
            <BadgeCheck className="size-4 shrink-0 text-signal" aria-label="Verified" />
          )}
        </div>
        <p className="truncate text-sm text-muted-foreground">@{person.handle}</p>
        <p className="mt-1 text-sm leading-relaxed text-foreground/80">{person.bio}</p>
      </div>
      <Button
        variant={following ? "secondary" : "default"}
        size="sm"
        onClick={() => void toggle()}
        className="shrink-0 rounded-full font-display font-bold"
      >
        {following ? "Following" : "Follow"}
      </Button>
    </li>
  );
}
