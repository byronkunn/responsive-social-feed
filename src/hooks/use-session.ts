import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export type PulseProfile = {
  id: string;
  email?: string;
  handle: string;
  display_name: string;
  bio: string;
  initials: string;
};

export function isLocalAuthFallbackEnabled() {
  return import.meta.env.DEV && import.meta.env["VITE_ENABLE_LOCAL_AUTH_FALLBACK"] === "true";
}

export function localProfileFromStorage(): PulseProfile | null {
  if (!isLocalAuthFallbackEnabled()) return null;
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("pulse_local_user");
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PulseProfile>;
    if (!parsed.id || !parsed.display_name || !parsed.handle || !parsed.initials) return null;
    return {
      id: parsed.id,
      ...(parsed.email ? { email: parsed.email } : {}),
      handle: parsed.handle,
      display_name: parsed.display_name,
      bio: parsed.bio ?? "",
      initials: parsed.initials,
    };
  } catch {
    localStorage.removeItem("pulse_local_user");
    return null;
  }
}

export function useSession() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!active) return;
      setSession(next);
      setLoading(false);
    });
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session ?? null);
      setLoading(false);
    });
    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session, user: session?.user ?? null, loading };
}

export function useProfile() {
  const { session, loading: sessionLoading } = useSession();
  const [profile, setProfile] = useState<PulseProfile | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [profileError, setProfileError] = useState<Error | null>(null);

  const userId = session?.user.id;

  useEffect(() => {
    let active = true;
    if (!userId) {
      setProfile(localProfileFromStorage());
      setProfileLoading(false);
      setProfileError(null);
      return;
    }
    setProfileLoading(true);
    setProfileError(null);
    supabase
      .from("profiles")
      .select("id, handle, display_name, bio, initials")
      .eq("id", userId)
      .maybeSingle()
      .then(({ data, error }) => {
        if (!active) return;
        setProfileLoading(false);
        if (error) {
          setProfileError(error);
          return;
        }
        setProfile((data as PulseProfile) ?? null);
      });
    return () => {
      active = false;
    };
  }, [userId]);

  return {
    session,
    user: session?.user ?? null,
    profile,
    setProfile,
    error: profileError,
    loading: sessionLoading || profileLoading,
  };
}
