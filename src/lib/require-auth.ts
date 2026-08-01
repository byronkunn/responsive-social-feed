import { redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";

export async function requireClientSession() {
  if (typeof window === "undefined") {
    return;
  }

  if (localStorage.getItem("pulse_local_user")) return;

  const { data, error } = await supabase.auth.getUser();
  if (!error && data.user) return;

  throw redirect({ to: "/auth" });
}
