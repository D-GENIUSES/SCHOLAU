import { solutionLines } from "@scholau/core";
import { MathText } from "./math-text";

export function SolutionWalkthrough({
  explanation,
  steps,
}: {
  explanation?: string | null;
  steps?: string[] | null;
}) {
  const lines = solutionLines(explanation, steps);
  if (lines.length) {
    return (
      <div>
        <p className="text-sm font-semibold">Solution</p>
        <ol className="mt-2 flex list-decimal flex-col gap-3 pl-5 text-sm leading-relaxed">
          {lines.map((step, index) => (
            <li key={index} className="min-w-0">
              <MathText text={step} />
            </li>
          ))}
        </ol>
      </div>
    );
  }
  if (!explanation?.trim()) return null;
  return (
    <div>
      <p className="text-sm font-semibold">Explanation</p>
      <p className="mt-1 whitespace-pre-line text-sm leading-relaxed">
        <MathText text={explanation} />
      </p>
    </div>
  );
}
