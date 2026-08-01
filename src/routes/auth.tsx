import { useCallback, useEffect, useState } from "react";
import { createFileRoute, Link, useNavigate, useRouter } from "@tanstack/react-router";
import { Radio, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { localProfileFromStorage, type PulseProfile } from "@/hooks/use-session";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign in or join Pulse" },
      {
        name: "description",
        content: "Create a Pulse account or sign back in to post, spark and follow the feed.",
      },
      { property: "og:title", content: "Sign in or join Pulse" },
      {
        property: "og:description",
        content: "Create a Pulse account or sign back in to post, spark and follow the feed.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: AuthPage,
});

const credentials = z.object({
  email: z.string().trim().email({ message: "Enter a valid email address" }).max(255),
  password: z.string().min(8, { message: "Password must be at least 8 characters" }).max(72),
});

const AUTH_ATTEMPTS_KEY = "pulse.auth-attempts";
const AUTH_ATTEMPT_WINDOW_MS = 15 * 60 * 1000;
const AUTH_ATTEMPT_LIMIT = 8;

function pruneAttempts(now: number, attempts: number[]) {
  return attempts.filter((timestamp) => now - timestamp < AUTH_ATTEMPT_WINDOW_MS);
}

function recordAuthAttempt() {
  if (typeof window === "undefined") return true;
  const now = Date.now();
  let attempts: number[] = [];
  try {
    attempts = pruneAttempts(now, JSON.parse(localStorage.getItem(AUTH_ATTEMPTS_KEY) ?? "[]"));
  } catch {
    attempts = [];
  }

  if (attempts.length >= AUTH_ATTEMPT_LIMIT) return false;
  localStorage.setItem(AUTH_ATTEMPTS_KEY, JSON.stringify([...attempts, now]));
  return true;
}

function AuthPage() {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();
  const router = useRouter();
  const localAuthEnabled = import.meta.env.DEV;

  function makeLocalProfile(name: string, emailAddress: string): PulseProfile {
    const base = name.trim() || emailAddress.split("@")[0] || "Pulse Member";
    const handle =
      base
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "")
        .slice(0, 24) || "member";
    const initials = base
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase();

    return {
      id: `local-${emailAddress.toLowerCase()}`,
      email: emailAddress.toLowerCase(),
      display_name: base,
      handle,
      initials: initials || "PM",
      bio: "Local prototype account. Connect Supabase email confirmation for production access.",
    };
  }

  async function finishLocalAccess(profile: PulseProfile, message: string) {
    localStorage.setItem("pulse_local_user", JSON.stringify(profile));
    toast.success(message);
    await router.invalidate();
    navigate({ to: "/" });
  }

  const finishSignedIn = useCallback(
    async (message: string) => {
      localStorage.removeItem("pulse_local_user");
      toast.success(message);
      await router.invalidate();
      navigate({ to: "/" });
    },
    [navigate, router],
  );

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const errorDescription = params.get("error_description");

    if (errorDescription) {
      toast.error(errorDescription);
      window.history.replaceState({}, "", window.location.pathname);
      return;
    }

    if (!code) return;

    let active = true;
    supabase.auth.exchangeCodeForSession(code).then(async ({ error }) => {
      if (!active) return;
      window.history.replaceState({}, "", window.location.pathname);
      if (error) {
        toast.error(error.message);
        return;
      }
      await finishSignedIn("Signed in");
    });

    return () => {
      active = false;
    };
  }, [finishSignedIn]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = credentials.safeParse({ email, password });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message ?? "Check your details");
      return;
    }
    if (!recordAuthAttempt()) {
      toast.error("Too many auth attempts. Wait a few minutes and try again.");
      return;
    }
    setBusy(true);

    const emailAddress = parsed.data.email ?? email.trim();
    const name = displayName.trim() || emailAddress.split("@")[0] || "Pulse Member";

    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword(parsed.data);
        if (error) {
          const localProfile = localAuthEnabled ? localProfileFromStorage() : null;
          if (localAuthEnabled && localProfile?.email === emailAddress.toLowerCase()) {
            await finishLocalAccess(localProfile, "Signed in locally");
            return;
          }
          toast.error(error.message);
          return;
        }
        await finishSignedIn("Signed in");
        return;
      } else {
        const { data, error } = await supabase.auth.signUp({
          ...parsed.data,
          options: {
            data: { display_name: name },
            emailRedirectTo: `${window.location.origin}/auth`,
          },
        });
        if (error) {
          toast.error(error.message);
          return;
        }

        if (!data.session) {
          if (localAuthEnabled) {
            await finishLocalAccess(
              makeLocalProfile(name, emailAddress),
              "Account created locally. Check email to enable production auth.",
            );
            return;
          }
          toast.success("Account created. Check your email to confirm your account.");
          setMode("signin");
          return;
        }

        await finishSignedIn("Account created");
        return;
      }
    } catch {
      toast.error("Authentication is unavailable right now. Try again.");
    } finally {
      setBusy(false);
    }
  }

  async function google() {
    setBusy(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      setBusy(false);
      toast.error("Google sign-in failed. Try again.");
      return;
    }
    if (result.redirected) return;
    await router.invalidate();
    navigate({ to: "/" });
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center gap-2 font-display text-2xl font-black">
          <Radio className="size-7 text-signal" />
          Pulse
        </Link>

        <h1 className="font-display text-3xl font-black tracking-tight">
          {mode === "signin" ? "Welcome back" : "Join Pulse"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {mode === "signin"
            ? "Sign in to pick up your feed where you left it."
            : "A smaller, friendlier place to think out loud."}
        </p>

        <div className="mt-6 grid grid-cols-2 gap-1 rounded-full bg-surface p-1">
          {(["signin", "signup"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setMode(m)}
              className={`rounded-full py-2 font-display text-sm font-bold transition-colors ${
                mode === m ? "bg-surface-2 text-foreground" : "text-muted-foreground"
              }`}
            >
              {m === "signin" ? "Sign in" : "Create account"}
            </button>
          ))}
        </div>

        <form onSubmit={submit} className="mt-6 space-y-4">
          {mode === "signup" && (
            <div className="space-y-1.5">
              <Label htmlFor="name">Display name</Label>
              <Input
                id="name"
                value={displayName}
                maxLength={50}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Ada Rowe"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
            />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <Label htmlFor="password">Password</Label>
              {mode === "signin" && (
                <Link to="/forgot-password" className="text-xs text-signal hover:underline">
                  Forgot?
                </Link>
              )}
            </div>
            <Input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="At least 8 characters"
              required
            />
          </div>
          <Button
            type="submit"
            disabled={busy}
            className="h-11 w-full rounded-full font-display font-bold"
          >
            {busy && <Loader2 className="size-4 animate-spin" />}
            {mode === "signin" ? "Sign in" : "Create account"}
          </Button>
        </form>

        <div className="my-5 flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          or
          <span className="h-px flex-1 bg-border" />
        </div>

        <Button
          variant="secondary"
          disabled={busy}
          onClick={google}
          className="h-11 w-full rounded-full font-display font-bold"
        >
          Continue with Google
        </Button>

        <p className="mt-6 text-center text-xs leading-relaxed text-muted-foreground">
          By continuing you agree to the{" "}
          <Link to="/terms" className="text-signal hover:underline">
            Terms
          </Link>
          ,{" "}
          <Link to="/privacy" className="text-signal hover:underline">
            Privacy Policy
          </Link>
          , and{" "}
          <Link to="/guidelines" className="text-signal hover:underline">
            Community Guidelines
          </Link>
          .
        </p>
      </div>
    </main>
  );
}
