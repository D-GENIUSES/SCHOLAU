"use client";

import { Upload } from "lucide-react";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { newRequestKey } from "@scholau/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
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

type CourseMaterial = { id: string; filename: string; bytes: number };

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
  const [materials, setMaterials] = useState<CourseMaterial[]>([]);
  const [materialsLoading, setMaterialsLoading] = useState(true);
  const [materialsError, setMaterialsError] = useState(false);

  const loadMaterials = useCallback(async () => {
    setMaterialsLoading(true);
    setMaterialsError(false);
    try {
      const response = await fetch(`/api/course-materials?offeringId=${encodeURIComponent(offeringId)}`, { credentials: "same-origin", cache: "no-store" });
      const body = await response.json();
      if (!response.ok || !Array.isArray(body.items)) throw new Error("Could not load materials");
      setMaterials(body.items as CourseMaterial[]);
    } catch {
      setMaterialsError(true);
    } finally {
      setMaterialsLoading(false);
    }
  }, [offeringId]);

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

  useEffect(() => {
    void loadMaterials();
  }, [loadMaterials]);

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
        void loadMaterials();
      } else if (body.status === "failed") {
        setMessage(body.error ?? "Processing failed.");
      } else if (body.status === "processing" || body.status === "pending") {
        window.setTimeout(() => void pollJob(id), 3000);
      }
    },
    [loadCurriculum, loadMaterials],
  );

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

      <section aria-labelledby="course-materials-heading" className="rounded-card border border-line bg-surface-card p-3.5 sm:p-4">
        <h2 id="course-materials-heading" className="text-sm font-semibold">Uploaded course materials</h2>
        <p className="mt-0.5 text-xs text-ink-muted">Shared files uploaded for this course by any lecturer or administrator.</p>
        {materialsLoading ? <p className="mt-2 text-sm text-ink-muted">Loading materials…</p> : null}
        {materialsError ? (
          <div className="mt-2 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-danger">Materials could not be loaded.</span>
            <Button type="button" size="sm" variant="outline" onClick={() => void loadMaterials()}>Retry</Button>
          </div>
        ) : null}
        {!materialsLoading && !materialsError && materials.length === 0 ? <p className="mt-2 text-sm text-ink-muted">No files have been uploaded for this course yet.</p> : null}
        {materials.length > 0 ? (
          <ul className="mt-2 divide-y divide-line rounded-control border border-line">
            {materials.map((material) => (
              <li key={material.id} className="flex min-w-0 flex-wrap items-center justify-between gap-2 px-3 py-2">
                <span className="min-w-0 flex-1 break-words text-sm font-medium">{material.filename}</span>
                <a
                  className="inline-flex min-h-9 shrink-0 items-center rounded-control px-2 text-sm font-semibold text-brand-primary underline-offset-2 hover:underline focus-visible:outline-2 focus-visible:outline-brand-primary"
                  href={`/api/course-materials?offeringId=${encodeURIComponent(offeringId)}&material=${encodeURIComponent(material.id)}`}
                >
                  Download
                </a>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

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
    </div>
  );
}
