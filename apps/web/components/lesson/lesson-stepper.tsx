"use client";

import { ArrowLeft, ArrowRight } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { LessonBlock } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/misc";
import { MathText } from "@/components/math/math-text";
import { splitLessonIntoSteps } from "@/lib/lesson-steps";
import { normalizeNoteBlocks } from "@/lib/lesson-note-blocks";
import { cn } from "@/lib/utils";
import { LessonBlocks } from "./blocks";

export function LessonStepper({ blocks, lessonId, version }: { blocks: LessonBlock[]; lessonId: string; version: string }) {
  const allCheckpoints = blocks.filter((block) => block.type === "checkpoint");
  const source = { kind: "checkpoint" as const, lessonId, version };
  const steps = useMemo(() => splitLessonIntoSteps(normalizeNoteBlocks(blocks)), [blocks]);
  const [index, setIndex] = useState(0);
  const [animKey, setAnimKey] = useState(0);
  const step = steps[index];
  const total = steps.length;

  useEffect(() => {
    const focus = new URLSearchParams(window.location.search).get("focus");
    if (focus !== "worked_example") return;
    const exampleStep = steps.findIndex(step => step.blocks.some(block =>
      block.type === "worked_example" || (block.type === "callout" && block.tone === "example")
    ));
    if (exampleStep < 0) return;
    const timer = window.setTimeout(() => setIndex(exampleStep), 0);
    return () => window.clearTimeout(timer);
  }, [steps]);

  const go = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(total - 1, next));
      if (clamped === index) return;
      setIndex(clamped);
      setAnimKey((k) => k + 1);
    },
    [index, total],
  );

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLElement && event.target.closest("input, textarea, select, button, a, .flashcard-deck")) return;
      if (document.activeElement instanceof HTMLElement && document.activeElement.closest(".flashcard-deck")) return;
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
    <div className="lesson-stepper flex flex-col gap-5">
      {total > 1 ? (
        <div className="lesson-stepper-chrome">
          <div className="flex flex-wrap items-end justify-between gap-2">
            <p className="text-xs font-bold uppercase tracking-[0.08em] text-brand-primary" aria-live="polite">
              Step {index + 1} of {total}
            </p>
            <p className="max-w-[min(100%,22rem)] truncate text-sm font-semibold text-ink">
              <MathText text={step.title} />
            </p>
          </div>
          <Progress value={progress} label="Lesson progress" />
        </div>
      ) : null}

      <div key={animKey} className={cn("lesson-step-panel", total > 1 && "lesson-step-enter")}>
        <LessonBlocks blocks={step.blocks} source={source} allCheckpoints={allCheckpoints} />
      </div>

      {total > 1 ? (
        <nav className="lesson-stepper-nav flex flex-wrap items-center justify-between gap-2" aria-label="Lesson steps">
          <Button type="button" variant="outline" size="sm" disabled={index === 0} onClick={() => go(index - 1)}>
            <ArrowLeft className="size-4" aria-hidden /> Previous
          </Button>
          <Button type="button" size="sm" disabled={index >= total - 1} onClick={() => go(index + 1)}>
            Next <ArrowRight className="size-4" aria-hidden />
          </Button>
        </nav>
      ) : null}
    </div>
  );
}
