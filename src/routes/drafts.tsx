import { useEffect, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { Trash2, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { AppShell, TopBar } from "@/components/pulse/app-shell";
import { Button } from "@/components/ui/button";
import { type Draft } from "@/lib/pulse-data";
import { requireClientSession } from "@/lib/require-auth";
import { deleteDraft, fetchDrafts } from "@/lib/social-api";

export const Route = createFileRoute("/drafts")({
  beforeLoad: requireClientSession,
  head: () => ({
    meta: [
      { title: "Drafts — unfinished pulses" },
      {
        name: "description",
        content: "Every pulse you started writing but haven't published yet.",
      },
      { property: "og:title", content: "Drafts — unfinished pulses" },
      {
        property: "og:description",
        content: "Every pulse you started writing but haven't published yet.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: DraftsPage,
});

function DraftsPage() {
  const [items, setItems] = useState<Draft[]>([]);
  const navigate = useNavigate();

  useEffect(() => {
    fetchDrafts()
      .then(setItems)
      .catch((error) => {
        toast.error(error instanceof Error ? error.message : "Drafts could not be loaded");
      });
  }, []);

  return (
    <AppShell>
      <TopBar title="Drafts" subtitle={`${items.length} unpublished`} />
      {items.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="font-display text-lg font-bold">Nothing saved</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Start a pulse and hit save — it'll wait here for you.
          </p>
          <Button
            className="mt-5 rounded-full font-display font-bold"
            onClick={() =>
              navigate({ to: "/compose", search: { draft: undefined, body: undefined } })
            }
          >
            Write something
          </Button>
        </div>
      ) : (
        <ul>
          {items.map((d) => (
            <li
              key={d.id}
              className="border-b border-border px-4 py-4 transition-colors hover:bg-surface/60 sm:px-6"
            >
              <p className="text-[0.95rem] leading-relaxed break-words text-foreground/90">
                {d.body}
              </p>
              <div className="mt-3 flex items-center justify-between gap-3">
                <span className="text-xs text-muted-foreground">Saved {d.savedAt}</span>
                <div className="flex shrink-0 items-center gap-1">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-signal"
                    onClick={() =>
                      navigate({ to: "/compose", search: { draft: d.id, body: d.body } })
                    }
                  >
                    <PencilLine className="size-4" />
                    Edit
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="rounded-full text-muted-foreground hover:text-destructive"
                    onClick={async () => {
                      try {
                        await deleteDraft(d.id);
                        setItems((prev) => prev.filter((x) => x.id !== d.id));
                        toast.success("Draft deleted");
                      } catch (error) {
                        toast.error(
                          error instanceof Error ? error.message : "Draft could not be deleted",
                        );
                      }
                    }}
                  >
                    <Trash2 className="size-4" />
                    <span className="sr-only">Delete draft</span>
                  </Button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </AppShell>
  );
}
