import { AlertTriangle, CheckCircle2, Circle, CircleDot, Loader2 } from "lucide-react";
import { COPY } from "@scholau/core";
import { cn } from "@/lib/utils";

export type AnswerStatus = "not_answered" | "selected" | "saved" | "unsaved";

export const ANSWER_STATUS: Record<AnswerStatus, { label: string; short: string; icon: typeof Circle; className: string }> = {
  not_answered: { label: "Not answered", short: "Not answered", icon: Circle, className: "text-ink-muted" },
  selected: { label: `${COPY.learning.selected} (not saved)`, short: COPY.learning.selected, icon: CircleDot, className: "text-brand-primary" },
  saved: { label: COPY.learning.saved, short: COPY.learning.saved, icon: CheckCircle2, className: "text-success" },
  unsaved: { label: COPY.learning.unsaved, short: "Not saved", icon: AlertTriangle, className: "text-warning" },
};

export function AnswerStatusLabel({ status, saving }: { status: AnswerStatus; saving?: boolean }) {
  const s = ANSWER_STATUS[status];
  const Icon = saving && status === "selected" ? Loader2 : s.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-sm font-semibold", s.className)}>
      <Icon className={cn("size-4", saving && status === "selected" && "animate-spin")} aria-hidden />
      {saving && status === "selected" ? `${COPY.learning.selected} — saving…` : s.label}
    </span>
  );
}
