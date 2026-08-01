import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell, TopBar } from "@/components/pulse/app-shell";

export const Route = createFileRoute("/guidelines")({
  head: () => ({
    meta: [
      { title: "Community Guidelines — Pulse" },
      { name: "description", content: "Pulse community and content policy." },
    ],
  }),
  component: GuidelinesPage,
});

function GuidelinesPage() {
  return (
    <AppShell rail={false}>
      <TopBar title="Community Guidelines" subtitle="Content and behavior policy" />
      <div className="space-y-6 px-4 py-6 sm:px-6">
        <Section title="Be Direct Without Abuse">
          Do not harass, threaten, dox, stalk, or coordinate abuse against another person.
        </Section>
        <Section title="No Hate or Dehumanization">
          Do not attack people based on protected attributes or promote hateful organizations,
          symbols, or ideology.
        </Section>
        <Section title="No Exploitation or Unsafe Sexual Content">
          Do not post sexual exploitation, non-consensual intimate media, sexual content involving
          minors, or content that normalizes abuse.
        </Section>
        <Section title="No Violence or Self-Harm Promotion">
          Do not threaten violence, incite harm, provide instructions for abuse, or encourage
          self-harm.
        </Section>
        <Section title="No Spam, Scams, or Platform Manipulation">
          Do not use automation, deceptive links, duplicate reports, fake engagement, impersonation,
          or coordinated spam to manipulate Pulse.
        </Section>
        <Section title="Reporting and Appeals">
          Use Report on posts or profiles when content violates these guidelines. If moderation
          affects you, follow the{" "}
          <Link to="/appeals" className="text-signal hover:underline">
            appeal process
          </Link>
          .
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
