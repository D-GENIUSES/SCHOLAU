"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { LecturerQuizQuestion } from "@scholau/core";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

type CurriculumLesson = {
  lesson_id: string;
  position: number;
  title: string;
  has_published: boolean;
};

type CurriculumModule = {
  id: string;
  title: string;
  position: number;
  lessons: CurriculumLesson[];
};

type Curriculum = {
  offering_id: string;
  course: { id: string; code: string; title: string };
  modules: CurriculumModule[];
};

export function GenerateQuestionsDialog({
  open,
  offeringId,
  quizId,
  currentQuestionCount,
  busy,
  onOpenChange,
  onBusyChange,
  onGenerated,
  onError,
}: {
  open: boolean;
  offeringId: string;
  quizId: string;
  currentQuestionCount: number;
  busy: boolean;
  onOpenChange: (open: boolean) => void;
  onBusyChange: (busy: boolean) => void;
  onGenerated: (questions: LecturerQuizQuestion[]) => void;
  onError: (error: unknown | null) => void;
}) {
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedModules, setSelectedModules] = useState<Set<string>>(() => new Set());
  const [selectedLessons, setSelectedLessons] = useState<Set<string>>(() => new Set());
  const [count, setCount] = useState("10");
  const [fieldError, setFieldError] = useState<string | null>(null);

  const remaining = Math.max(0, 100 - currentQuestionCount);
  const maxCount = Math.min(30, remaining);
  const minCount = remaining >= 10 ? 10 : 0;

  const publishedModules = useMemo(() => {
    if (!curriculum) return [];
    return curriculum.modules
      .map((module) => ({
        ...module,
        lessons: module.lessons.filter((lesson) => lesson.has_published),
      }))
      .filter((module) => module.lessons.length > 0);
  }, [curriculum]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await getBrowserSupabase().rpc("get_lecturer_course_curriculum_v1", {
        p_offering_id: offeringId,
      });
      if (error) throw error;
      setCurriculum(data as Curriculum);
    } catch {
      setCurriculum(null);
      setLoadError("Could not load course topics.");
    } finally {
      setLoading(false);
    }
  }, [offeringId]);

  useEffect(() => {
    if (!open) return;
    setSelectedModules(new Set());
    setSelectedLessons(new Set());
    const initial = Math.min(10, Math.max(0, 100 - currentQuestionCount));
    setCount(String(initial >= 10 ? initial : 10));
    setFieldError(null);
    void load();
  }, [open, load, currentQuestionCount]);

  function toggleLesson(moduleId: string, lessonId: string, checked: boolean) {
    setSelectedLessons((prev) => {
      const next = new Set(prev);
      if (checked) next.add(lessonId);
      else next.delete(lessonId);
      return next;
    });
    setSelectedModules((prev) => {
      const next = new Set(prev);
      next.delete(moduleId);
      return next;
    });
    setFieldError(null);
  }

  function toggleModule(module: CurriculumModule, checked: boolean) {
    const lessonIds = module.lessons.map((lesson) => lesson.lesson_id);
    setSelectedModules((prev) => {
      const next = new Set(prev);
      if (checked) next.add(module.id);
      else next.delete(module.id);
      return next;
    });
    setSelectedLessons((prev) => {
      const next = new Set(prev);
      for (const id of lessonIds) {
        if (checked) next.add(id);
        else next.delete(id);
      }
      return next;
    });
    setFieldError(null);
  }

  function moduleState(module: CurriculumModule): "all" | "some" | "none" {
    const ids = module.lessons.map((lesson) => lesson.lesson_id);
    const picked = ids.filter((id) => selectedLessons.has(id) || selectedModules.has(module.id)).length;
    if (picked === 0) return "none";
    if (picked === ids.length) return "all";
    return "some";
  }

  const selectionCount = useMemo(() => {
    const lessons = new Set(selectedLessons);
    for (const module of publishedModules) {
      if (!selectedModules.has(module.id)) continue;
      for (const lesson of module.lessons) lessons.add(lesson.lesson_id);
    }
    return lessons.size;
  }, [publishedModules, selectedLessons, selectedModules]);

  const parsedCount = Number(count);
  const countValid =
    minCount >= 10 &&
    Number.isInteger(parsedCount) &&
    parsedCount >= minCount &&
    parsedCount <= maxCount;
  const canSubmit = selectionCount > 0 && countValid && !busy && !loading && remaining >= 10;

  async function generate() {
    if (!canSubmit) {
      if (remaining < 10) setFieldError("Need room for at least 10 more questions (100 max).");
      else if (selectionCount < 1) setFieldError("Select at least one topic or lesson.");
      else setFieldError(`Choose between ${minCount} and ${maxCount} questions.`);
      return;
    }

    const moduleIds = [...selectedModules];
    const lessonIds = [...selectedLessons].filter((id) => {
      // Explicit lesson picks that are not already covered by a selected module.
      return !publishedModules.some(
        (module) => selectedModules.has(module.id) && module.lessons.some((lesson) => lesson.lesson_id === id),
      );
    });

    onBusyChange(true);
    setFieldError(null);
    onError(null);
    try {
      const res = await fetch("/api/lecturer-quiz-generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          offeringId,
          quizId: quizId || undefined,
          moduleIds,
          lessonIds,
          questionCount: parsedCount,
        }),
      });
      const json = (await res.json()) as { questions?: LecturerQuizQuestion[]; error?: string };
      if (!res.ok) throw new Error(json.error || "Generation failed.");
      if (!json.questions?.length) throw new Error("No questions were generated.");
      onGenerated(json.questions);
      onOpenChange(false);
    } catch (error) {
      onError(error);
    } finally {
      onBusyChange(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogTitle>Generate questions</DialogTitle>
        <DialogDescription>
          Choose published topics or lessons, then how many questions to create. Review them before they join the quiz.
        </DialogDescription>

        {remaining < 10 ? (
          <p role="alert" className="text-sm text-danger">
            This quiz already has {currentQuestionCount} questions. Free at least {10 - remaining} slot
            {10 - remaining === 1 ? "" : "s"} (100 max) before generating.
          </p>
        ) : null}

        {loading ? <p className="text-sm text-ink-muted">Loading topics…</p> : null}
        {loadError ? (
          <p role="alert" className="text-sm text-danger">
            {loadError}{" "}
            <button type="button" className="font-semibold underline" onClick={() => void load()}>
              Retry
            </button>
          </p>
        ) : null}

        {!loading && !loadError && publishedModules.length === 0 ? (
          <p className="text-sm text-ink-muted">Publish at least one lesson before generating questions from topics.</p>
        ) : null}

        {!loading && publishedModules.length > 0 ? (
          <fieldset disabled={busy} className="space-y-2">
            <legend className="text-sm font-semibold">Topics</legend>
            <p className="text-xs text-ink-muted">{selectionCount} lesson{selectionCount === 1 ? "" : "s"} selected</p>
            <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {publishedModules.map((module) => {
                const state = moduleState(module);
                return (
                  <li key={module.id} className="rounded-control border border-line">
                    <details open={publishedModules.length <= 4}>
                      <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 py-2 text-sm font-semibold">
                        <input
                          type="checkbox"
                          className="size-4 shrink-0 accent-brand-primary"
                          checked={state === "all"}
                          ref={(el) => {
                            if (el) el.indeterminate = state === "some";
                          }}
                          onClick={(event) => event.stopPropagation()}
                          onChange={(event) => toggleModule(module, event.target.checked)}
                          aria-label={`Select all lessons in ${module.title}`}
                        />
                        <span className="min-w-0 flex-1 wrap-break-word">{module.title}</span>
                        <span className="text-xs font-normal text-ink-muted">{module.lessons.length}</span>
                      </summary>
                      <ul className="border-t border-line px-3 py-1">
                        {module.lessons.map((lesson) => {
                          const checked = selectedLessons.has(lesson.lesson_id) || selectedModules.has(module.id);
                          return (
                            <li key={lesson.lesson_id}>
                              <label className="flex min-h-10 items-center gap-2 py-1.5 text-sm">
                                <input
                                  type="checkbox"
                                  className="size-4 shrink-0 accent-brand-primary"
                                  checked={checked}
                                  onChange={(event) => toggleLesson(module.id, lesson.lesson_id, event.target.checked)}
                                />
                                <span className="min-w-0 wrap-break-word">{lesson.title}</span>
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    </details>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        ) : null}

        <label className="block text-sm">
          Questions
          <Input
            type="number"
            inputMode="numeric"
            min={minCount || 10}
            max={maxCount || 30}
            required
            disabled={busy || remaining < 10}
            value={count}
            onChange={(event) => {
              setCount(event.target.value);
              setFieldError(null);
            }}
            className={cn("mt-1 w-24", !countValid && count !== "" ? "border-danger" : undefined)}
            aria-invalid={!countValid}
            aria-describedby="generate-count-hint"
          />
        </label>
        <p id="generate-count-hint" className="text-xs text-ink-muted">
          {remaining >= 10
            ? `Required. Choose ${minCount}–${maxCount} questions grounded in the selected published content.`
            : "Clear space in the quiz before generating."}
        </p>

        {fieldError ? (
          <p role="alert" className="text-sm text-danger">
            {fieldError}
          </p>
        ) : null}

        <DialogFooter className="gap-2">
          <DialogClose asChild>
            <Button type="button" variant="outline" size="sm" disabled={busy}>
              Cancel
            </Button>
          </DialogClose>
          <Button type="button" size="sm" loading={busy} disabled={!canSubmit} onClick={() => void generate()}>
            Generate
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
