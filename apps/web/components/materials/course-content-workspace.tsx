"use client";

import { Upload } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { newRequestKey } from "@scholau/api";
import type { LessonBlock } from "@scholau/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { LoadingState } from "@/components/ui/states";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type CurriculumLesson = {
  lesson_id: string;
  position: number;
  title: string;
  version_id: string;
  version_status: string;
  ready: boolean;
  has_published: boolean;
};

type LessonEditorRecord = {
  lesson_id: string;
  version_id: string;
  version_status: string;
  title: string;
  objective: string;
  blocks: LessonBlock[];
  estimated_minutes: number;
  source_reference: string | null;
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

type OutlineSegment = {
  lesson_position: number;
  lesson_title: string;
  source_hint: string;
  confidence?: string;
};

export function CourseContentWorkspace({
  offeringId,
}: {
  offeringId: string;
}) {
  const [curriculum, setCurriculum] = useState<Curriculum | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState<string | null>(null);
  const [editingModule, setEditingModule] = useState<string | null>(null);
  const [moduleTitleDraft, setModuleTitleDraft] = useState("");
  const [uploadTarget, setUploadTarget] = useState<{
    scope: "lesson" | "topic";
    moduleId: string;
    moduleTitle: string;
    lessonId?: string;
    lessonTitle?: string;
  } | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [mergeMode, setMergeMode] = useState("fork_from_published");
  const [jobId, setJobId] = useState<string | null>(null);
  const [jobStatus, setJobStatus] = useState<string | null>(null);
  const [proposedOutline, setProposedOutline] = useState<{ module_title: string; segments: OutlineSegment[] } | null>(null);
  const [uploading, setUploading] = useState(false);
  const [editingLesson, setEditingLesson] = useState<LessonEditorRecord | null>(null);
  const [lessonSaving, setLessonSaving] = useState(false);

  const loadCurriculum = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await getBrowserSupabase().rpc("get_lecturer_course_curriculum_v1", {
        p_offering_id: offeringId,
      });
      if (error) throw error;
      setCurriculum(data as Curriculum);
    } catch {
      setMessage("Could not load course topics and lessons.");
    } finally {
      setLoading(false);
    }
  }, [offeringId]);

  useEffect(() => {
    void loadCurriculum();
  }, [loadCurriculum]);

  const pollJob = useCallback(
    async function pollJob(id: string) {
      const res = await fetch(`/api/material-ingestion?jobId=${encodeURIComponent(id)}`, { credentials: "same-origin" });
      if (!res.ok) return;
      const body = await res.json();
      setJobStatus(body.status ?? null);
      if (body.status === "awaiting_outline") {
        const outline = body.proposed_outline ?? body.stats?.proposed_outline;
        if (outline) setProposedOutline(outline as typeof proposedOutline);
      }
      if (body.status === "succeeded") {
        setMessage("Processing finished. Review draft lessons below.");
        setUploadTarget(null);
        setFile(null);
        setProposedOutline(null);
        void loadCurriculum();
      } else if (body.status === "failed") {
        setMessage(body.error ?? "Processing failed.");
      } else if (body.status === "processing" || body.status === "pending") {
        window.setTimeout(() => void pollJob(id), 3000);
      }
    },
    [loadCurriculum],
  );

  const openLessonEditor = async (lessonId: string) => {
    setMessage(null);
    const { data, error } = await getBrowserSupabase().rpc("get_lecturer_lesson_editor_v1", {
      p_offering_id: offeringId,
      p_lesson_id: lessonId,
    });
    if (error || !data) {
      setMessage("Could not load lesson content for editing.");
      return;
    }
    const record = data as LessonEditorRecord;
    setEditingLesson({ ...record, blocks: Array.isArray(record.blocks) ? record.blocks : [] });
  };

  const saveLessonDraft = async () => {
    if (!editingLesson) return;
    setLessonSaving(true);
    setMessage(null);
    const { error } = await getBrowserSupabase().rpc("lecturer_save_lesson_draft_v1", {
      p_offering_id: offeringId,
      p_lesson_id: editingLesson.lesson_id,
      p_title: editingLesson.title,
      p_objective: editingLesson.objective,
      p_blocks: editingLesson.blocks,
      p_estimated_minutes: editingLesson.estimated_minutes,
      p_source_reference: editingLesson.source_reference,
      p_request_key: newRequestKey(),
    });
    setLessonSaving(false);
    if (error) {
      setMessage(error.message || "Could not save lesson draft.");
      return;
    }
    setEditingLesson(null);
    setMessage("Lesson draft saved. Publish it when it is ready for students.");
    void loadCurriculum();
  };

  const upload = async () => {
    if (!uploadTarget || !file) return;
    setUploading(true);
    setMessage(null);
    setProposedOutline(null);
    const form = new FormData();
    form.set("offeringId", offeringId);
    form.set("ingestionScope", uploadTarget.scope);
    form.set("moduleId", uploadTarget.moduleId);
    form.set("moduleTitle", uploadTarget.moduleTitle);
    if (uploadTarget.lessonId) form.set("lessonId", uploadTarget.lessonId);
    form.set("mergeMode", mergeMode);
    form.set("topicMode", "existing_module");
    form.set("file", file);
    const res = await fetch("/api/material-ingestion", { method: "POST", body: form, credentials: "same-origin" });
    setUploading(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.message ?? "Upload failed.");
      return;
    }
    const id = body.job_id as string;
    setJobId(id);
    setJobStatus("pending");
    void pollJob(id);
  };

  const confirmOutline = async () => {
    if (!jobId || !proposedOutline) return;
    setUploading(true);
    const res = await fetch("/api/material-ingestion", {
      method: "PATCH",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jobId, outline: proposedOutline }),
    });
    setUploading(false);
    if (!res.ok) {
      setMessage("Could not confirm lesson split.");
      return;
    }
    setJobStatus("pending");
    void pollJob(jobId);
  };

  const saveModuleTitle = async (moduleId: string) => {
    const title = moduleTitleDraft.trim();
    if (!title) return;
    const { error } = await getBrowserSupabase().rpc("lecturer_update_module_title_v1", {
      p_module_id: moduleId,
      p_title: title,
    });
    if (error) {
      setMessage("Could not save topic title.");
      return;
    }
    setEditingModule(null);
    void loadCurriculum();
  };

  const publishLesson = async (versionId: string) => {
    const { error } = await getBrowserSupabase().rpc("lecturer_publish_lesson_v1", {
      p_offering_id: offeringId,
      p_lesson_version_id: versionId,
      p_request_key: newRequestKey(),
    });
    if (error) {
      setMessage("Lesson is not ready to publish yet.");
      return;
    }
    setMessage("Lesson published for students.");
    void loadCurriculum();
  };

  if (loading) return <LoadingState label="Loading course content…" />;

  return (
    <div className="space-y-3">
      <p className="text-xs text-ink-muted">Upload sources to a lesson or split a file across a topic.</p>
      {message ? <Alert tone="info">{message}</Alert> : null}

      {curriculum?.modules.length === 0 ? (
        <Alert tone="warning">No topics yet. Use legacy material upload to create the first module.</Alert>
      ) : null}

      <ul className="divide-y divide-line overflow-hidden rounded-card border border-line bg-surface-card">
        {curriculum?.modules.map((mod) => (
          <li key={mod.id} className="px-3.5 py-3 sm:px-4">
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {editingModule === mod.id ? (
                  <div className="flex flex-wrap gap-2">
                    <Input value={moduleTitleDraft} onChange={(e) => setModuleTitleDraft(e.target.value)} aria-label="Topic title" />
                    <Button size="sm" onClick={() => void saveModuleTitle(mod.id)}>Save</Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingModule(null)}>Cancel</Button>
                  </div>
                ) : (
                  <>
                    <p className="text-sm font-semibold">{mod.title}</p>
                    <p className="text-xs text-ink-muted">Topic {mod.position}</p>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => {
                    setEditingModule(mod.id);
                    setModuleTitleDraft(mod.title);
                  }}
                >
                  Edit
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setUploadTarget({ scope: "topic", moduleId: mod.id, moduleTitle: mod.title })}
                >
                  <Upload className="size-3.5" aria-hidden /> Topic
                </Button>
              </div>
            </div>
            <ol className="mt-2 divide-y divide-line border-t border-line">
              {mod.lessons.map((lesson) => (
                <li key={lesson.lesson_id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                  <div className="min-w-0">
                    <p className="text-sm font-medium">{lesson.title}</p>
                    <p className="text-xs text-ink-muted">
                      Lesson {lesson.position} · {lesson.version_status}
                      {lesson.ready ? " · Ready" : ""}
                      {lesson.has_published ? " · Live" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    <Button size="sm" variant="outline" onClick={() => void openLessonEditor(lesson.lesson_id)}>
                      Edit lesson
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() =>
                        setUploadTarget({
                          scope: "lesson",
                          moduleId: mod.id,
                          moduleTitle: mod.title,
                          lessonId: lesson.lesson_id,
                          lessonTitle: lesson.title,
                        })
                      }
                    >
                      Upload
                    </Button>
                    {lesson.version_status === "draft" && lesson.ready ? (
                      <Button size="sm" onClick={() => void publishLesson(lesson.version_id)}>Publish</Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
            {mod.lessons.length === 0 ? <p className="mt-2 text-xs text-ink-muted">No lessons in this topic yet.</p> : null}
          </li>
        ))}
      </ul>

      {uploadTarget ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">
              {uploadTarget.scope === "lesson"
                ? `Upload to ${uploadTarget.lessonTitle}`
                : `Upload across ${uploadTarget.moduleTitle}`}
            </CardTitle>
            <CardDescription>
              {uploadTarget.scope === "lesson"
                ? "Content is extracted into this lesson as a draft."
                : "Review the suggested lesson split before importing the file."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Field id="merge-mode" label="Merge mode">
              <NativeSelect id="merge-mode" value={mergeMode} onChange={(e: ChangeEvent<HTMLSelectElement>) => setMergeMode(e.target.value)}>
                <option value="fork_from_published">Replace draft / new version</option>
                <option value="append_blocks">Append to existing blocks</option>
                <option value="replace_draft">Replace current draft only</option>
              </NativeSelect>
            </Field>
            <Field id="source-file" label="Source file">
              <Input id="source-file" type="file" accept=".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </Field>
            {proposedOutline ? (
              <div className="rounded-control border border-line p-3">
                <h3 className="mb-1.5 text-sm font-semibold">Confirm lesson split</h3>
                <ul className="space-y-1.5 text-sm">
                  {proposedOutline.segments.map((seg, i) => (
                    <li key={i}>
                      <strong>{seg.lesson_position}. {seg.lesson_title}</strong>
                      <span className="text-ink-muted"> — {seg.source_hint}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-2" size="sm" onClick={() => void confirmOutline()} loading={uploading}>
                  Confirm and import
                </Button>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void upload()} disabled={uploading || !file} loading={uploading}>Process file</Button>
              <Button size="sm" variant="ghost" onClick={() => setUploadTarget(null)}>Cancel</Button>
            </div>
            {jobId ? <p className="text-xs text-ink-muted">Job {jobId} — {jobStatus ?? "…"}</p> : null}
          </CardContent>
        </Card>
      ) : null}

      {editingLesson ? (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Edit lesson content</CardTitle>
            <CardDescription>Save a draft first. Students continue to see the published lesson until you publish the update.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Field id="lesson-title" label="Lesson title"><Input id="lesson-title" value={editingLesson.title} maxLength={200} onChange={(event) => setEditingLesson({ ...editingLesson, title: event.target.value })} /></Field>
            <Field id="lesson-objective" label="Learning objective"><Textarea id="lesson-objective" value={editingLesson.objective} maxLength={1000} onChange={(event) => setEditingLesson({ ...editingLesson, objective: event.target.value })} /></Field>
            <div className="grid gap-3 sm:grid-cols-2">
              <Field id="lesson-duration" label="Estimated minutes"><Input id="lesson-duration" type="number" min={1} max={240} value={editingLesson.estimated_minutes} onChange={(event) => setEditingLesson({ ...editingLesson, estimated_minutes: Number(event.target.value) })} /></Field>
              <Field id="lesson-source" label="Content source"><Input id="lesson-source" value={editingLesson.source_reference ?? ""} maxLength={500} onChange={(event) => setEditingLesson({ ...editingLesson, source_reference: event.target.value })} /></Field>
            </div>
            <LessonBlocksEditor blocks={editingLesson.blocks} onChange={(blocks) => setEditingLesson({ ...editingLesson, blocks })} />
            <div className="flex flex-wrap gap-2"><Button size="sm" onClick={() => void saveLessonDraft()} loading={lessonSaving}>Save draft</Button><Button size="sm" variant="ghost" onClick={() => setEditingLesson(null)} disabled={lessonSaving}>Cancel</Button></div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

const BLOCK_TYPES: LessonBlock["type"][] = ["heading", "paragraph", "equation", "list", "callout", "code", "worked_example", "checkpoint", "image"];

function createBlock(type: LessonBlock["type"]): LessonBlock {
  switch (type) {
    case "heading": return { type, text: "", level: 2 };
    case "paragraph": return { type, text: "" };
    case "equation": return { type, expression: "" };
    case "list": return { type, items: [""] };
    case "callout": return { type, text: "", tone: "info" };
    case "code": return { type, code: "" };
    case "worked_example": return { type, title: "", problem: "", steps: [{ calculation: "", explanation: "" }], answer: "" };
    case "checkpoint": return { type, question: "", options: ["", ""], correct_index: 0, explanation: "" };
    case "image": return { type, path: "", alt: "" };
  }
}

function LessonBlocksEditor({ blocks, onChange }: { blocks: LessonBlock[]; onChange: (blocks: LessonBlock[]) => void }) {
  const update = (index: number, value: LessonBlock) => onChange(blocks.map((block, i) => i === index ? value : block));
  return <section className="space-y-2" aria-label="Lesson content blocks">
    <h3 className="text-sm font-semibold">Lesson content</h3>
    {blocks.map((block, index) => <LessonBlockEditor key={`${index}-${block.type}`} block={block} index={index} onChange={(next) => update(index, next)} onRemove={() => onChange(blocks.filter((_, i) => i !== index))} />)}
    <NativeSelect aria-label="Add content block" value="" onChange={(event) => { if (event.target.value) onChange([...blocks, createBlock(event.target.value as LessonBlock["type"])]); }}>
      <option value="">Add content block…</option>{BLOCK_TYPES.map((type) => <option key={type} value={type}>{type.replaceAll("_", " ")}</option>)}
    </NativeSelect>
  </section>;
}

function LessonBlockEditor({ block, index, onChange, onRemove }: { block: LessonBlock; index: number; onChange: (block: LessonBlock) => void; onRemove: () => void }) {
  const textField = (label: string, value: string, set: (value: string) => void) => <Field id={`block-${index}-${label.replaceAll(" ", "-")}`} label={label}><Textarea id={`block-${index}-${label.replaceAll(" ", "-")}`} value={value} onChange={(event) => set(event.target.value)} /></Field>;
  let fields;
  switch (block.type) {
    case "heading": fields = <>{textField("Heading text", block.text, (text) => onChange({ ...block, text }))}<NativeSelect aria-label="Heading level" value={block.level ?? 2} onChange={(event) => onChange({ ...block, level: Number(event.target.value) as 2 | 3 | 4 })}><option value={2}>Heading 2</option><option value={3}>Heading 3</option><option value={4}>Heading 4</option></NativeSelect></>; break;
    case "paragraph": fields = textField("Paragraph", block.text, (text) => onChange({ ...block, text })); break;
    case "equation": fields = <>{textField("Equation", block.expression, (expression) => onChange({ ...block, expression }))}{textField("Reading (optional)", block.reading ?? "", (reading) => onChange({ ...block, reading: reading || undefined }))}</>; break;
    case "list": fields = <>{textField("List items (one per line)", block.items.join("\n"), (value) => onChange({ ...block, items: value.split("\n") }))}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={block.ordered ?? false} onChange={(event) => onChange({ ...block, ordered: event.target.checked })} /> Numbered list</label></>; break;
    case "callout": fields = <>{textField("Callout title (optional)", block.title ?? "", (title) => onChange({ ...block, title: title || undefined }))}{textField("Callout text", block.text, (text) => onChange({ ...block, text }))}<NativeSelect aria-label="Callout style" value={block.tone ?? "info"} onChange={(event) => onChange({ ...block, tone: event.target.value as NonNullable<typeof block.tone> })}><option value="info">Note</option><option value="tip">Tip</option><option value="warning">Warning</option><option value="example">Example</option></NativeSelect></>; break;
    case "code": fields = <>{textField("Code", block.code, (code) => onChange({ ...block, code }))}{textField("Language (optional)", block.language ?? "", (language) => onChange({ ...block, language: language || undefined }))}</>; break;
    case "worked_example": fields = <>{textField("Example title", block.title, (title) => onChange({ ...block, title }))}{textField("Problem", block.problem, (problem) => onChange({ ...block, problem }))}{textField("Steps (calculation | explanation, one per line)", block.steps.map((step) => `${step.calculation} | ${step.explanation}`).join("\n"), (value) => onChange({ ...block, steps: value.split("\n").map((line, stepIndex) => { const [calculation = "", ...explanation] = line.split("|"); return { ...(block.steps[stepIndex] ?? { calculation: "", explanation: "" }), calculation: calculation.trim(), explanation: explanation.join("|").trim() }; }) }))}{textField("Step narration (one per line)", block.steps.map((step) => step.reading ?? "").join("\n"), (value) => onChange({ ...block, steps: value.split("\n").map((reading, stepIndex) => ({ ...(block.steps[stepIndex] ?? { calculation: "", explanation: "" }), reading: reading.trim() || undefined })) }))}{textField("Answer", block.answer, (answer) => onChange({ ...block, answer }))}{textField("Answer narration (optional)", block.answer_reading ?? "", (answer_reading) => onChange({ ...block, answer_reading: answer_reading || undefined }))}<label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={Boolean(block.check)} onChange={(event) => onChange({ ...block, check: event.target.checked ? block.check ?? { calculation: "", explanation: "" } : undefined })} /> Include worked check</label>{block.check ? <>{textField("Check calculation", block.check.calculation, (calculation) => onChange({ ...block, check: { ...block.check!, calculation } }))}{textField("Check explanation", block.check.explanation, (explanation) => onChange({ ...block, check: { ...block.check!, explanation } }))}{textField("Check narration (optional)", block.check.reading ?? "", (reading) => onChange({ ...block, check: { ...block.check!, reading: reading || undefined } }))}</> : null}</>; break;
    case "checkpoint": fields = <>{textField("Question", block.question, (question) => onChange({ ...block, question }))}{textField("Options (one per line)", block.options.join("\n"), (value) => { const options = value.split("\n"); onChange({ ...block, options, correct_index: Math.min(block.correct_index, Math.max(0, options.length - 1)) }); })}<NativeSelect aria-label="Correct option" value={block.correct_index} onChange={(event) => onChange({ ...block, correct_index: Number(event.target.value) })}>{block.options.map((option, i) => <option key={i} value={i}>{`Option ${i + 1}${option ? `: ${option.slice(0, 50)}` : ""}`}</option>)}</NativeSelect>{textField("Explanation", block.explanation, (explanation) => onChange({ ...block, explanation }))}</>; break;
    case "image": fields = <>{textField("Image asset path", block.path, (path) => onChange({ ...block, path }))}{textField("Alt text", block.alt, (alt) => onChange({ ...block, alt }))}{textField("Caption (optional)", block.caption ?? "", (caption) => onChange({ ...block, caption: caption || undefined }))}</>; break;
  }
  return <div className="space-y-2 rounded-control border border-line bg-surface-page p-3"><div className="flex items-center justify-between gap-2"><p className="text-xs font-semibold capitalize">{block.type.replaceAll("_", " ")}</p><Button type="button" size="sm" variant="ghost" onClick={onRemove}>Remove</Button></div>{fields}</div>;
}
