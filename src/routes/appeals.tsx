import { createFileRoute } from "@tanstack/react-router";
import { AppShell, TopBar } from "@/components/pulse/app-shell";

export const Route = createFileRoute("/appeals")({
  head: () => ({
    meta: [
      { title: "Appeals — Pulse" },
      { name: "description", content: "How to appeal Pulse moderation decisions." },
    ],
  }),
  component: AppealsPage,
});

function AppealsPage() {
  return (
    <AppShell rail={false}>
      <TopBar title="Appeals" subtitle="Review process for moderation decisions" />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <Section title="What Can Be Appealed">
          Content removals, hidden posts, account suspensions, bans, and role changes can be
          reviewed when the user provides context that may change the moderation decision.
        </Section>
        <Section title="What To Include">
          Include your account handle, the content or report id if available, what happened, why you
          believe the decision should change, and any relevant safety context.
        </Section>
        <Section title="Review Standard">
          Appeals should be reviewed by an admin who did not take the original action whenever
          possible. The final decision and reason should be recorded in the moderation audit log.
        </Section>
        <Section title="Temporary Contact">
          Until a dedicated appeal form is added, route appeals through the site operator's support
          email or issue tracker and record the outcome in the admin audit trail.
        </Section>
      </div>
    </AppShell>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="max-w-3xl">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </section>
  );
}
