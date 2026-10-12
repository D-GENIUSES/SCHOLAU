import { CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/utils";

export function CorrectnessBadge({ correct }: { correct: boolean }) {
  return correct ? (
    <Badge tone="success">
      <CheckCircle2 className="size-3.5" aria-hidden /> Correct
    </Badge>
  ) : (
    <Badge tone="danger">
      <XCircle className="size-3.5" aria-hidden /> Incorrect
    </Badge>
  );
}

export function AnswerFeedback({
  correct,
  explanation,
  className,
}: {
  correct: boolean;
  explanation: string | null | undefined;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-2 rounded-control border p-4",
        correct ? "border-[#b8e0cc] bg-success-bg" : "border-[#f3c4bf] bg-danger-bg",
        className,
      )}
    >
      <p className={cn("inline-flex items-center gap-2 font-bold", correct ? "text-success" : "text-danger")}>
        {correct ? <CheckCircle2 className="size-5" aria-hidden /> : <XCircle className="size-5" aria-hidden />}
        {correct ? "Correct" : "Incorrect"}
      </p>
      {explanation ? (
        <div className="text-ink">
          <p className="text-sm font-semibold">Explanation</p>
          <p className="whitespace-pre-line">{explanation}</p>
        </div>
      ) : null}
    </div>
  );
}
