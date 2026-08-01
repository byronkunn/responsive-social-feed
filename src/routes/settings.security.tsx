import { useState } from "react";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { ArrowLeft, KeyRound, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";
import { requireClientSession } from "@/lib/require-auth";

export const Route = createFileRoute("/settings/security")({
  beforeLoad: requireClientSession,
  head: () => ({
    meta: [
      { title: "Password & account — Pulse settings" },
      {
        name: "description",
        content: "Change your Pulse password or permanently deactivate your account.",
      },
      { property: "og:title", content: "Password & account — Pulse settings" },
      {
        property: "og:description",
        content: "Change your Pulse password or permanently deactivate your account.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: SecuritySettings,
});

function SecuritySettings() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState("");

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (password.length < 8) {
      toast.error("Use at least 8 characters");
      return;
    }
    if (password !== confirm) {
      toast.error("Passwords don't match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    setPassword("");
    setConfirm("");
    toast.success("Password updated");
  }

  async function deactivate() {
    if (confirmDelete !== "DELETE") {
      toast.error("Type DELETE to confirm");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("delete_current_user");
    if (error) {
      setBusy(false);
      toast.error(error.message);
      return;
    }
    localStorage.removeItem("pulse_local_user");
    await supabase.auth.signOut({ scope: "global" });
    toast.success("Your account and profile were deleted.");
    navigate({ to: "/auth", replace: true });
  }

  return (
    <AppShell rail={false}>
      <TopBar title="Password & account" subtitle="Security and deactivation" />
      <div className="px-4 py-5 sm:px-6">
        <Link
          to="/settings"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="size-4" /> Back to settings
        </Link>

        <form onSubmit={changePassword} className="mt-6 max-w-lg space-y-4">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold">
            <KeyRound className="size-5 text-signal" /> Change password
          </h2>
          <div className="space-y-1.5">
            <Label htmlFor="new-password">New password</Label>
            <Input
              id="new-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-password">Confirm password</Label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
          </div>
          <Button type="submit" disabled={busy} className="rounded-full font-display font-bold">
            Update password
          </Button>
        </form>

        <div className="mt-10 max-w-lg space-y-4 rounded-3xl border border-destructive/40 p-4 sm:p-5">
          <h2 className="flex items-center gap-2 font-display text-lg font-bold text-destructive">
            <TriangleAlert className="size-5" /> Deactivate account
          </h2>
          <p className="text-sm leading-relaxed text-muted-foreground">
            This removes your profile from Pulse and signs you out everywhere. Type{" "}
            <span className="font-semibold text-foreground">DELETE</span> to confirm.
          </p>
          <div className="space-y-1.5">
            <Label htmlFor="confirm-delete" className="sr-only">
              Type DELETE to confirm
            </Label>
            <Input
              id="confirm-delete"
              value={confirmDelete}
              placeholder="DELETE"
              onChange={(e) => setConfirmDelete(e.target.value)}
            />
          </div>
          <Button
            variant="destructive"
            onClick={deactivate}
            disabled={busy || confirmDelete !== "DELETE"}
            className="rounded-full font-display font-bold"
          >
            Deactivate my account
          </Button>
        </div>
      </div>
    </AppShell>
  );
}
