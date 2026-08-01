import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isLocalAuthFallbackEnabled } from "@/hooks/use-session";

export async function requireClientSession() {
  if (typeof window === "undefined") {
    return;
  }

  if (isLocalAuthFallbackEnabled() && localStorage.getItem("pulse_local_user")) return;

  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) return;

  throw redirect({ to: "/auth" });
}
