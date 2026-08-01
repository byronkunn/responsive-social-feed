import { createFileRoute } from "@tanstack/react-router";
import { AppShell, TopBar } from "@/components/pulse/app-shell";

export const Route = createFileRoute("/privacy")({
  head: () => ({
    meta: [
      { title: "Privacy Policy — Pulse" },
      { name: "description", content: "How Pulse handles account, content, and safety data." },
    ],
  }),
  component: PrivacyPage,
});

function PrivacyPage() {
  return (
    <AppShell rail={false}>
      <TopBar title="Privacy Policy" subtitle="How Pulse handles data" />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <Section title="Data We Store">
          Pulse stores account profiles, posts, replies, reactions, follows, messages,
          notifications, reports, moderation actions, and uploaded media needed to run the service.
        </Section>
        <Section title="Private Messages">
          Message access is restricted by database row-level security to conversation participants.
          Moderation tooling does not expose private messages unless future safety review workflows
          explicitly add that capability.
        </Section>
        <Section title="Safety Records">
          Reports, restrictions, and moderation audit logs are retained so administrators can
          investigate abuse, enforce policy consistently, and respond to appeals.
        </Section>
        <Section title="Monitoring">
          Production error monitoring may receive technical details such as browser version, route,
          stack traces, and release environment. It is configured not to intentionally collect
          sensitive personal content.
        </Section>
        <Section title="Deletion">
          Users can request account deletion from settings. Some safety, legal, or audit records may
          be retained when necessary to protect the service.
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
