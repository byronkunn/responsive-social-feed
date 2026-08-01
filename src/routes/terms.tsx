import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, TopBar } from "@/components/pulse/app-shell";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — Pulse" },
      { name: "description", content: "The terms for using Pulse." },
    ],
  }),
  component: TermsPage,
});

function TermsPage() {
  return (
    <AppShell rail={false}>
      <TopBar title="Terms of Service" subtitle="Rules for using Pulse" />
      <PolicyBody>
        <Section title="Your Account">
          You are responsible for activity from your account. Keep your sign-in method secure and do
          not impersonate another person or organization.
        </Section>
        <Section title="Your Content">
          You keep ownership of what you post, but you grant Pulse permission to host, display, and
          distribute it so the service can work. Do not post content you do not have rights to use.
        </Section>
        <Section title="Moderation">
          Pulse may remove content, restrict accounts, or preserve records when needed to enforce
          the Community Guidelines, comply with law, or protect the service.
        </Section>
        <Section title="Service Changes">
          Features may change as Pulse evolves. We may limit or suspend access for security,
          operational, legal, or abuse-prevention reasons.
        </Section>
        <Section title="Appeals">
          If your content or account is moderated, review the{" "}
          <Link to="/appeals" className="text-signal hover:underline">
            appeal process
          </Link>
          .
        </Section>
      </PolicyBody>
    </AppShell>
  );
}

function PolicyBody({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6 px-4 py-6 sm:px-6">{children}</div>;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="max-w-3xl">
      <h2 className="font-display text-lg font-bold">{title}</h2>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{children}</p>
    </section>
  );
}
