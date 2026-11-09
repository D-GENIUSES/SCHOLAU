import type { LecturerQuizState } from "@scholau/core";
import { formatDateTime, pluralize } from "@scholau/core";
import { Badge } from "@/components/ui/misc";
import { Alert } from "@/components/ui/alert";

const labels: Record<LecturerQuizState, string> = {
  draft: "Draft",
  upcoming: "Scheduled",
  open: "Open",
  closed: "Closed",
  cancelled: "Cancelled",
};

const tones: Record<LecturerQuizState, "neutral" | "brand" | "success" | "warning" | "danger"> = {
  draft: "neutral",
  upcoming: "warning",
  open: "brand",
  closed: "neutral",
  cancelled: "danger",
};

export function QuizStateBadge({ state }: { state: LecturerQuizState | string }) {
  const known = state in labels ? (state as LecturerQuizState) : null;
  const label = known ? labels[known] : String(state || "Unknown");
  return <Badge tone={known ? tones[known] : "neutral"}>{label === "Open" ? "Open now" : label}</Badge>;
}

export function formatQuizWindow(opens: string | null, closes: string | null) {
  if (!opens || !closes) return "Schedule not set";
  return `${formatDateTime(opens)} – ${formatDateTime(closes)}`;
}

export function studentClassQuizCta(state: LecturerQuizState): string {
  if (state === "open") return "Take quiz";
  if (state === "upcoming") return "View schedule";
  if (state === "closed") return "View closed quiz";
  return "Details";
}

export function QuizStudentStatus({
  state,
  opensAt,
  closesAt,
  questionCount,
  durationMinutes,
  maxAttempts,
  attemptsUsed,
  submitted,
}: {
  state: LecturerQuizState;
  opensAt: string | null;
  closesAt: string | null;
  questionCount: number;
  durationMinutes: number;
  maxAttempts: number;
  attemptsUsed: number;
  submitted: boolean;
}) {
  const windowLine = formatQuizWindow(opensAt, closesAt);
  const meta = `${pluralize(questionCount, "question")} · ${durationMinutes} min per attempt · ${pluralize(maxAttempts, "attempt", "attempts")}`;

  if (submitted) return null;

  if (state === "closed") {
    return (
      <Alert tone="warning" title="Quiz closed" role="status">
        <p>This class quiz is no longer accepting submissions.</p>
        <p className="mt-2">
          <span className="font-medium">Scheduled window:</span> {windowLine}
        </p>
        <p className="mt-2 text-ink-muted">
          {attemptsUsed > 0
            ? "You started an attempt but did not submit before the window closed. Contact your lecturer if you believe this is a mistake."
            : "You did not take this quiz during the open window. Review the instructions above and check with your lecturer if you need another opportunity."}
        </p>
      </Alert>
    );
  }

  if (state === "upcoming") {
    return (
      <Alert tone="info" title="Scheduled" role="status">
        <p>This quiz is not open yet. {meta}</p>
        <p className="mt-2">
          <span className="font-medium">Opens and closes:</span> {windowLine}
        </p>
      </Alert>
    );
  }

  if (state === "open" && attemptsUsed >= maxAttempts) {
    return (
      <Alert tone="warning" title="No attempts left" role="status">
        <p>You have used all {maxAttempts} allowed {maxAttempts === 1 ? "attempt" : "attempts"} for this quiz.</p>
        <p className="mt-2 text-ink-muted">Window: {windowLine}</p>
      </Alert>
    );
  }

  if (state === "open") {
    return (
      <Alert tone="info" title="Open now" role="status">
        <p>{meta}</p>
        <p className="mt-2 text-ink-muted">Submit before {formatDateTime(closesAt)}.</p>
      </Alert>
    );
  }

  if (state === "cancelled") {
    return (
      <Alert tone="error" title="Cancelled" role="status">
        <p>Your lecturer cancelled this quiz. No score will be recorded.</p>
      </Alert>
    );
  }

  return null;
}

export function defaultQuizWindow() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);
  return { opens_at: start.toISOString(), closes_at: end.toISOString() };
}
