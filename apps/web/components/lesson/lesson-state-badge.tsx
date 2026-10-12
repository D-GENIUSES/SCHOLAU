import { CheckCircle2, Circle, CircleDot } from "lucide-react";
import type { LessonState } from "@scholau/core";
import { Badge } from "@/components/ui/misc";

const STATES: Record<LessonState, { label: string; tone: "neutral" | "brand" | "success"; icon: typeof Circle }> = {
  not_started: { label: "Not started", tone: "neutral", icon: Circle },
  started: { label: "In progress", tone: "brand", icon: CircleDot },
  completed: { label: "Completed", tone: "success", icon: CheckCircle2 },
};

export function LessonStateBadge({ state }: { state: LessonState }) {
  const s = STATES[state];
  const Icon = s.icon;
  return (
    <Badge tone={s.tone}>
      <Icon className="size-3.5" aria-hidden />
      {s.label}
    </Badge>
  );
}
