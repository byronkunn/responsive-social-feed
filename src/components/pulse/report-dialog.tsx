import { useState } from "react";
import { Flag } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { submitModerationReport } from "@/lib/social-api";
import { cn } from "@/lib/utils";

const reportReasons = [
  "Harassment or abuse",
  "Hate or hateful symbols",
  "Spam or scams",
  "Sexual or unsafe content",
  "Violence or threats",
  "Impersonation",
  "Other",
] as const;

export function ReportDialog({
  targetType,
  targetId,
  targetLabel,
  triggerClassName,
}: {
  targetType: "post" | "profile";
  targetId: string;
  targetLabel: string;
  triggerClassName?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<(typeof reportReasons)[number]>("Harassment or abuse");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const fullReason = `${reason}${details.trim() ? `: ${details.trim()}` : ""}`;
      await submitModerationReport(targetType, targetId, fullReason);
      toast.success("Report sent to moderators");
      setDetails("");
      setReason("Harassment or abuse");
      setOpen(false);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not send report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          type="button"
          aria-label={`Report ${targetLabel}`}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-2 hover:text-destructive",
            triggerClassName,
          )}
        >
          <Flag className="size-4" />
          <span>Report</span>
        </button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Report {targetLabel}</DialogTitle>
          <DialogDescription>
            Reports go to the moderation queue for review. The other user is not notified.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor={`${targetType}-${targetId}-reason`}>Reason</Label>
            <select
              id={`${targetType}-${targetId}-reason`}
              value={reason}
              onChange={(event) => setReason(event.target.value as (typeof reportReasons)[number])}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {reportReasons.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label htmlFor={`${targetType}-${targetId}-details`}>Details</Label>
            <Textarea
              id={`${targetType}-${targetId}-details`}
              value={details}
              maxLength={420}
              onChange={(event) => setDetails(event.target.value)}
              placeholder="Add context moderators should know."
              className="min-h-28 resize-none"
            />
            <p className="text-right text-xs tabular-nums text-muted-foreground">
              {details.length}/420
            </p>
          </div>
        </div>

        <DialogFooter>
          <Button variant="secondary" disabled={busy} onClick={() => setOpen(false)}>
            Cancel
          </Button>
          <Button variant="destructive" disabled={busy} onClick={() => void submit()}>
            Send report
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
