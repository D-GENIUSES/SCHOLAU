"use client";

import { useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { AdminPageHeader } from "@/components/admin/shared";
import { BlockPreview } from "@/components/admin/block-preview";
import { courseMaterialBundleSchema, type CourseMaterialBundle } from "@/lib/course-material-schema";

export default function ContentSyncPage() {
  const queryClient = useQueryClient();
  const [bundle, setBundle] = useState<CourseMaterialBundle | null>(null);
  const [validated, setValidated] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const selection = useRef(0);

  async function choose(file: File | undefined) {
    const selected = ++selection.current;
    setBundle(null); setValidated(false); setMessage("");
    if (!file) return;
    try {
      if (file.size > 4 * 1024 * 1024) throw new Error("Choose one course bundle up to 4 MB.");
      const parsed = courseMaterialBundleSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) throw new Error("Choose a generated course synchronization bundle.");
      if (selected === selection.current) setBundle(parsed.data);
    } catch (error) { if (selected === selection.current) setMessage(error instanceof Error ? error.message : "This file could not be read."); }
  }

  async function run(dryRun: boolean, publish = false) {
    if (!bundle) return;
    setBusy(true); setMessage("");
    try {
      const response = await fetch("/api/admin/content-sync", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ bundle, dryRun, publish }) });
      const result = await response.json();
      if (!response.ok || result.valid !== true) {
        setValidated(false);
        throw new Error(result.message || "Validation failed. Check lesson blocks, question fields and source references in the bundle.");
      }
      setValidated(true);
      setMessage(dryRun ? "Validation passed. Source files were verified in storage."
        : result.published ? "Materials, lessons, questions and assessments are published for this course."
        : "Drafts saved. Review the source bundle and questions before publishing.");
      if (!dryRun) await queryClient.invalidateQueries();
    } catch (error) { setMessage(error instanceof Error ? error.message : "Synchronization failed. You can retry this course."); }
    finally { setBusy(false); }
  }

  return <>
    <AdminPageHeader title="Course materials" description="Turn source material into explained lessons, worked examples, and practice." />
    <div className="flex max-w-2xl flex-col gap-5">
      <p>Upload one generated course bundle. Review the explanations, examples and practice checks below. Validate the sources, save drafts, then publish when the teaching content and assessment answers are ready.</p>
      <label className="flex flex-col gap-2 font-semibold">Course bundle (JSON)
        <input type="file" accept=".json,application/json" disabled={busy} onChange={event => void choose(event.target.files?.[0])} />
      </label>
      {bundle ? <p>{bundle.course_code}: {bundle.materials.length} materials, {bundle.lessons.length} lessons, {bundle.questions.length} questions.</p> : null}
      {bundle ? <div className="flex flex-col gap-3">{bundle.lessons.map((lesson, index) => <details key={index} className="rounded-control border border-line p-4">
        <summary className="cursor-pointer font-bold">Lesson {index + 1}: {String(lesson.title)}</summary>
        <div className="mt-4"><BlockPreview blocks={lesson.blocks} /><p className="mt-4 text-sm text-ink-muted">Source: {String(lesson.source_reference)}</p></div>
      </details>)}</div> : null}
      <div className="flex flex-wrap gap-3">
        <Button disabled={!bundle || busy} onClick={() => void run(true)}>Validate</Button>
        <Button variant="outline" disabled={!validated || busy} onClick={() => void run(false)}>Save drafts</Button>
        <Button variant="secondary" disabled={!validated || busy} onClick={() => void run(false, true)}>Publish reviewed content</Button>
      </div>
      <p role="status" aria-live="polite">{busy ? "Checking sources and synchronizing this course…" : message}</p>
    </div>
  </>;
}
