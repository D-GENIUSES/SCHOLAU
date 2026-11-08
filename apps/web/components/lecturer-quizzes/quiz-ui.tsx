import type { LecturerQuizState } from "@scholau/core";
import { Badge } from "@/components/ui/misc";

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
  closed: "success",
  cancelled: "danger",
};

export function QuizStateBadge({ state }: { state: LecturerQuizState | string }) {
  const known = state in labels ? (state as LecturerQuizState) : null;
  const label = known ? labels[known] : String(state || "Unknown");
  return <Badge tone={known ? tones[known] : "neutral"}>{label === "Open" ? "Open now" : label}</Badge>;
}

export function formatQuizWindow(opens: string | null, closes: string | null) {
  if (!opens || !closes) return "Schedule not set";
  const fmt: Intl.DateTimeFormatOptions = { dateStyle: "medium", timeStyle: "short" };
  return `${new Date(opens).toLocaleString(undefined, fmt)} – ${new Date(closes).toLocaleString(undefined, fmt)}`;
}

export function defaultQuizWindow() {
  const start = new Date();
  start.setMinutes(0, 0, 0);
  start.setHours(start.getHours() + 1);
  const end = new Date(start);
  end.setHours(end.getHours() + 2);
  return { opens_at: start.toISOString(), closes_at: end.toISOString() };
}
