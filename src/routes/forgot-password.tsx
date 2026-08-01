import { useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { Radio, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [
      { title: "Reset your Pulse password" },
      {
        name: "description",
        content: "Send yourself a password reset link for your Pulse account.",
      },
      { property: "og:title", content: "Reset your Pulse password" },
      {
        property: "og:description",
        content: "Send yourself a password reset link for your Pulse account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: ForgotPassword,
});

function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = z.string().trim().email().max(255).safeParse(email);
    if (!parsed.success) {
      toast.error("Enter a valid email address");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.resetPasswordForEmail(parsed.data, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setSent(true);
  }

  return (
    <main className="grid min-h-screen place-items-center px-4 py-10">
      <div className="w-full max-w-sm">
        <Link to="/" className="mb-8 flex items-center gap-2 font-display text-2xl font-black">
          <Radio className="size-7 text-signal" />
          Pulse
        </Link>
        <h1 className="font-display text-3xl font-black tracking-tight">Forgot password</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          We'll email you a link to set a new one.
        </p>

        {sent ? (
          <div className="mt-6 rounded-3xl bg-surface p-6 text-sm leading-relaxed text-muted-foreground">
            If an account exists for <strong className="text-foreground">{email}</strong>, a reset
            link is on its way.
          </div>
        ) : (
          <form onSubmit={submit} className="mt-6 space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                required
              />
            </div>
            <Button
              type="submit"
              disabled={busy}
              className="h-11 w-full rounded-full font-display font-bold"
            >
              {busy && <Loader2 className="size-4 animate-spin" />}
              Send reset link
            </Button>
          </form>
        )}

        <Link to="/auth" className="mt-6 block text-center text-sm text-signal hover:underline">
          Back to sign in
        </Link>
      </div>
    </main>
  );
}
