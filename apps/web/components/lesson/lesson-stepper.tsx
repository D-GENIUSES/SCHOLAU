"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LessonBlock } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { MathText } from "@/components/math/math-text";
import { splitLessonIntoSteps } from "@/lib/lesson-steps";
import { LessonBlocks } from "./blocks";

export function LessonStepper({ blocks }: { blocks: LessonBlock[] }) {
  const steps = useMemo(() => splitLessonIntoSteps(blocks), [blocks]);
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const total = steps.length;
  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (focus !== "worked_example") return;
    const exampleStep = steps.findIndex(step => step.blocks.some(block =>
      block.type === "worked_example" || (block.type === "callout" && block.tone === "example")
    ));
    if (exampleStep >= 0) setIndex(exampleStep);
  }, [steps]);


  const go = useCallback(
    (next: number) => {
      setIndex(Math.max(0, Math.min(total - 1, next)));
    },
    [total],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button, a")) return;
      if (event.key === "ArrowRight") {
        event.preventDefault();
        go(index + 1);
      }
      if (event.key === "ArrowLeft") {
        event.preventDefault();
        go(index - 1);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index]);

  if (!step) return null;

  const progress = total > 1 ? ((index + 1) / total) * 100 : 100;

  return (
    <div className="flex flex-col gap-4">
      {total > 1 ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-semibold text-ink-muted" aria-live="polite">
              Step {index + 1} of {total}
            </p>
            <p className="max-w-[min(100%,20rem)] truncate text-sm font-bold text-ink">
              <MathText text={step.title} />
            </p>
          </div>
          <Progress value={progress} label="Lesson progress" />
        </>
      ) : null}
      <LessonBlocks blocks={step.blocks} />
      {total > 1 ? (
        <nav className="flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4" aria-label="Lesson steps">
          <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => go(index - 1)}>
            <ArrowLeft className="size-4" aria-hidden /> Previous
          </Button>
          <Button type="button" size="sm" disabled={index >= total - 1} onClick={() => go(index + 1)}>
            Next <ArrowRight className="size-4" aria-hidden />
          </Button>
        </nav>
      ) : null}
      {total > 1 ? (
        <details className="rounded-control border border-line bg-surface-page">
          <summary className="cursor-pointer px-4 py-3 text-sm font-semibold text-brand-primary">View all sections</summary>
          <div className="border-t border-line px-4 py-4">
            <LessonBlocks blocks={blocks} />
          </div>
        </details>
      ) : null}
    </div>
  );
}
