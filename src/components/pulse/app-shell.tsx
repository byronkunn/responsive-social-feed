import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Home,
  Hash,
  Bell,
  Mail,
  Bookmark,
  User,
  Feather,
  Radio,
  ListMusic,
  Users,
  Settings,
  FileText,
  LogOut,
  LogIn,
} from "lucide-react";
import { Avatar } from "./avatar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useProfile } from "@/hooks/use-session";
import { currentUser, trends, suggestions } from "@/lib/pulse-data";

const nav = [
  { to: "/", label: "Home", icon: Home },
  { to: "/explore", label: "Explore", icon: Hash },
  { to: "/notifications", label: "Notifications", icon: Bell },
  { to: "/messages", label: "Messages", icon: Mail },
  { to: "/lists", label: "Lists", icon: ListMusic },
  { to: "/communities", label: "Communities", icon: Users },
  { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { to: "/drafts", label: "Drafts", icon: FileText },
  { to: "/profile", label: "Profile", icon: User },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

const mobileNavLabels = ["Home", "Explore", "Notifications", "Messages", "Profile"];
const mobileNav = nav.filter((n) => mobileNavLabels.includes(n.label));

export function AppShell({ children, rail = true }: { children: React.ReactNode; rail?: boolean }) {
  const { session, profile } = useProfile();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const name = profile?.display_name ?? currentUser.name;
  const handle = profile?.handle ?? currentUser.handle;
  const initials = (profile?.initials ?? currentUser.initials).slice(0, 2).toUpperCase();

  async function signOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    localStorage.removeItem("pulse_local_user");
    await supabase.auth.signOut({ scope: "global" });
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl gap-0 px-0 sm:px-4">
      {/* Left nav: icons on md, full on xl */}
      <aside className="sticky top-0 hidden h-screen shrink-0 flex-col justify-between overflow-y-auto border-r border-border py-4 md:flex md:w-[88px] md:items-center xl:w-[268px] xl:items-stretch xl:px-3">
        <div className="flex flex-col gap-1">
          <Link
            to="/"
            className="mb-2 flex items-center gap-2 rounded-2xl px-3 py-2 font-display text-xl font-black tracking-tight"
          >
            <Radio className="size-6 shrink-0 text-signal" />
            <span className="hidden xl:inline">Pulse</span>
          </Link>
          {nav.map(({ to, label, icon: Icon }) => (
            <Link
              key={to}
              to={to}
              activeOptions={{ exact: to === "/" }}
              activeProps={{ className: "bg-surface-2 text-foreground" }}
              className="flex items-center gap-4 rounded-2xl px-3 py-3 text-base text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
            >
              <Icon className="size-6 shrink-0" />
              <span className="hidden font-display font-semibold xl:inline">{label}</span>
            </Link>
          ))}
          <Button
            asChild
            className="mt-3 h-12 rounded-full font-display text-base font-bold shadow-lift"
          >
            <Link to="/compose" search={{ draft: undefined, body: undefined }}>
              <Feather className="size-5" />
              <span className="hidden xl:inline">New pulse</span>
            </Link>
          </Button>
        </div>

        {session ? (
          <div className="flex items-center gap-3 rounded-2xl p-2 xl:hover:bg-surface">
            <Avatar initials={initials} />
            <div className="hidden min-w-0 flex-1 xl:block">
              <p className="truncate font-display text-sm font-bold">{name}</p>
              <p className="truncate text-xs text-muted-foreground">@{handle}</p>
            </div>
            <button
              type="button"
              onClick={signOut}
              aria-label="Sign out"
              className="hidden shrink-0 rounded-full p-2 text-muted-foreground transition-colors hover:bg-surface-2 hover:text-foreground xl:grid"
            >
              <LogOut className="size-4" />
            </button>
          </div>
        ) : (
          <Link
            to="/auth"
            className="flex items-center gap-3 rounded-2xl p-3 text-muted-foreground transition-colors hover:bg-surface hover:text-foreground"
          >
            <LogIn className="size-6 shrink-0" />
            <span className="hidden font-display text-sm font-bold xl:inline">Sign in</span>
          </Link>
        )}
      </aside>

      {/* Feed column */}
      <main className="min-w-0 flex-1 border-border pb-20 md:pb-0 lg:border-r">{children}</main>

      {/* Right rail */}
      {rail && (
        <aside className="sticky top-0 hidden h-screen w-[340px] shrink-0 flex-col gap-4 overflow-y-auto px-5 py-4 lg:flex">
          <div className="rounded-3xl bg-surface p-4">
            <h2 className="font-display text-lg font-bold">What's pulsing</h2>
            <ul className="mt-3 space-y-3">
              {trends.map((t) => (
                <li key={t.title} className="min-w-0">
                  <Link to="/search" search={{ q: t.title }} className="block min-w-0">
                    <p className="truncate text-xs text-muted-foreground">{t.topic}</p>
                    <p className="truncate font-display text-sm font-bold">{t.title}</p>
                    <p className="text-xs text-muted-foreground">{t.count}</p>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-3xl bg-surface p-4">
            <h2 className="font-display text-lg font-bold">Worth following</h2>
            <ul className="mt-3 space-y-3">
              {suggestions.map((s) => (
                <li key={s.handle} className="flex items-center gap-3">
                  <Avatar initials={s.initials} className="size-9" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-display text-sm font-bold">{s.name}</p>
                    <p className="truncate text-xs text-muted-foreground">@{s.handle}</p>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    className="shrink-0 rounded-full font-semibold"
                  >
                    Follow
                  </Button>
                </li>
              ))}
            </ul>
          </div>

          <p className="px-2 text-xs leading-relaxed text-muted-foreground">
            Pulse is a small, friendlier place to think out loud.
          </p>
        </aside>
      )}

      {/* Mobile bottom nav */}
      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur md:hidden">
        <ul className="flex items-center justify-around px-2 py-2">
          {mobileNav.map(({ to, label, icon: Icon }) => (
            <li key={to}>
              <Link
                to={to}
                activeOptions={{ exact: to === "/" }}
                activeProps={{ className: "text-signal" }}
                className="grid size-11 place-items-center rounded-full text-muted-foreground transition-colors"
                aria-label={label}
              >
                <Icon className="size-6" />
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

export function TopBar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-30 grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border bg-background/85 px-4 py-3 backdrop-blur sm:px-6">
      <div className="min-w-0">
        <h1 className="truncate font-display text-xl font-black">{title}</h1>
        {subtitle && <p className="truncate text-xs text-muted-foreground">{subtitle}</p>}
      </div>
      <div className="flex shrink-0 items-center gap-2 md:hidden">
        <Avatar initials={currentUser.initials} className="size-9" />
      </div>
    </header>
  );
}
