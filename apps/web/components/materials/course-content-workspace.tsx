"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, useCallback, useEffect, useState } from "react";
import { newRequestKey } from "@scholau/api";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
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

export function CourseContentWorkspace({
  offeringId,
  backHref,
  backLabel,
}: {
  offeringId: string;
  backHref: string;
  backLabel: string;
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
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        eyebrow={curriculum?.course.code}
        title="Topics and lessons"
        description="Upload sources to a single lesson or split a file across every lesson in a topic."
      />
      <Button asChild variant="outline">
        <Link href={backHref}>{backLabel}</Link>
      </Button>
      {message ? <Alert tone="info">{message}</Alert> : null}

      {curriculum?.modules.length === 0 ? (
        <Alert tone="warning">No topics yet. Use legacy material upload to create the first module.</Alert>
      ) : null}

      {curriculum?.modules.map((mod) => (
        <Card key={mod.id}>
          <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2">
            <div className="min-w-0 flex-1">
              {editingModule === mod.id ? (
                <div className="flex flex-wrap gap-2">
                  <Input value={moduleTitleDraft} onChange={(e) => setModuleTitleDraft(e.target.value)} aria-label="Topic title" />
                  <Button size="sm" onClick={() => void saveModuleTitle(mod.id)}>
                    Save title
                  </Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditingModule(null)}>
                    Cancel
                  </Button>
                </div>
              ) : (
                <>
                  <CardTitle>{mod.title}</CardTitle>
                  <CardDescription>Topic {mod.position}</CardDescription>
                </>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setEditingModule(mod.id);
                  setModuleTitleDraft(mod.title);
                }}
              >
                Edit title
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() =>
                  setUploadTarget({ scope: "topic", moduleId: mod.id, moduleTitle: mod.title })
                }
              >
                <Upload className="size-4" aria-hidden /> Upload to topic
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <ol className="divide-y divide-line">
              {mod.lessons.map((lesson) => (
                <li key={lesson.lesson_id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div className="min-w-0">
                    <p className="font-medium">{lesson.title}</p>
                    <p className="text-sm text-ink-muted">
                      Lesson {lesson.position} · {lesson.version_status}
                      {lesson.ready ? " · Ready" : ""}
                      {lesson.has_published ? " · Live for students" : ""}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
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
                      <Button size="sm" onClick={() => void publishLesson(lesson.version_id)}>
                        Publish
                      </Button>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
            {mod.lessons.length === 0 ? <p className="text-sm text-ink-muted">No lessons in this topic yet.</p> : null}
          </CardContent>
        </Card>
      ))}

      {uploadTarget ? (
        <Card>
          <CardHeader>
            <CardTitle>
              {uploadTarget.scope === "lesson"
                ? `Upload to ${uploadTarget.lessonTitle}`
                : `Upload across ${uploadTarget.moduleTitle}`}
            </CardTitle>
            <CardDescription>
              {uploadTarget.scope === "lesson"
                ? "Content is extracted into this lesson as a draft."
                : "Gemini proposes how to split the file across lessons; you confirm before import."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
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
              <div className="rounded-control border border-line p-4">
                <h3 className="mb-2 text-sm font-semibold">Confirm lesson split</h3>
                <ul className="space-y-2 text-sm">
                  {proposedOutline.segments.map((seg, i) => (
                    <li key={i}>
                      <strong>
                        {seg.lesson_position}. {seg.lesson_title}
                      </strong>
                      <span className="text-ink-muted"> — {seg.source_hint}</span>
                    </li>
                  ))}
                </ul>
                <Button className="mt-3" onClick={() => void confirmOutline()} loading={uploading}>
                  Confirm and import
                </Button>
              </div>
            ) : null}
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void upload()} disabled={uploading || !file} loading={uploading}>
                Process with Gemini
              </Button>
              <Button variant="ghost" onClick={() => setUploadTarget(null)}>
                Cancel
              </Button>
            </div>
            {jobId ? <p className="text-sm text-ink-muted">Job {jobId} — {jobStatus ?? "…"}</p> : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
