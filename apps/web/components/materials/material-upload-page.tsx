"use client";

import { Upload } from "lucide-react";
import Link from "next/link";
import { type ChangeEvent, useCallback, useEffect, useMemo, useState } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/misc";
import { LoadingState } from "@/components/ui/states";

type Offering = { id: string; code: string; title: string };

export function MaterialUploadPage({
  workspace,
  backHref,
  backLabel,
}: {
  workspace: "lecturer" | "admin";
  backHref: string;
  backLabel: string;
}) {
  const [offerings, setOfferings] = useState<Offering[]>([]);
  const [role, setRole] = useState<"admin" | "lecturer" | null>(null);
  const [loading, setLoading] = useState(true);
  const [offeringId, setOfferingId] = useState("");
  const [topicMode, setTopicMode] = useState("new_module");
  const [moduleTitle, setModuleTitle] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const supabase = getBrowserSupabase();
        const { data, error } = await supabase.rpc("get_material_ingestion_offerings_v1");
        if (error) throw error;
        setOfferings((data?.items as Offering[]) ?? []);
        setRole((data?.role as "admin" | "lecturer") ?? null);
      } catch {
        setMessage("You need lecturer or administrator access to upload materials.");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pollJob = useCallback(async function pollJob(id: string) {
    const res = await fetch(`/api/material-ingestion?jobId=${encodeURIComponent(id)}`, { credentials: "same-origin" });
    if (!res.ok) return;
    const body = await res.json();
    setStatus(body.status ?? null);
    if (body.status === "succeeded") {
      setMessage(`Processing finished. ${JSON.stringify(body.stats ?? {})}`);
    } else if (body.status === "failed") {
      setMessage(body.error ?? "Processing failed.");
    } else if (body.status === "processing" || body.status === "pending") {
      window.setTimeout(() => void pollJob(id), 3000);
    }
  }, []);

  const upload = async () => {
    if (!offeringId || !file) return;
    setUploading(true);
    setMessage(null);
    const form = new FormData();
    form.set("offeringId", offeringId);
    form.set("topicMode", topicMode);
    form.set("moduleTitle", moduleTitle);
    form.set("file", file);
    const res = await fetch("/api/material-ingestion", { method: "POST", body: form, credentials: "same-origin" });
    setUploading(false);
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setMessage(body.message ?? "Upload failed.");
      return;
    }
    if (body.duplicate_file) {
      setMessage(body.message ?? "This file was already processed for this course.");
      return;
    }
    const id = body.job_id as string;
    setJobId(id);
    setStatus("pending");
    void pollJob(id);
  };

  /** Shared courses (e.g. AUE-GST 201) have many published offerings; one row per code. */
  const courseOptions = useMemo(() => {
    const byCode = new Map<string, Offering>();
    for (const o of offerings) {
      if (!byCode.has(o.code)) byCode.set(o.code, o);
    }
    return [...byCode.values()].sort((a, b) => a.code.localeCompare(b.code));
  }, [offerings]);

  const eyebrow = workspace === "admin" ? "Admin · content pipeline" : "Lecturer workspace";
  const courseHint =
    role === "admin"
      ? "As an administrator you can upload for any published offering."
      : "You can upload for courses you are assigned to teach.";

  if (loading) return <LoadingState label="Loading courses…" />;

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader
        eyebrow={eyebrow}
        title="Upload course materials"
        description="Upload PDFs, Word, PowerPoint, text, or images. Files go to Cloudflare R2; Gemini converts them into draft lessons, flashcards, and questions (structured for the app). An administrator publishes after review."
      />
      <Card>
        <CardHeader>
          <CardTitle>Source file</CardTitle>
          <CardDescription>{courseHint}</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <Field id="offering" label="Course offering">
            <NativeSelect id="offering" value={offeringId} onChange={(e: ChangeEvent<HTMLSelectElement>) => setOfferingId(e.target.value)}>
              <option value="">Select course…</option>
              {courseOptions.map((o) => (
                <option key={o.code} value={o.id}>
                  {o.code} — {o.title}
                </option>
              ))}
            </NativeSelect>
          </Field>
          {courseOptions.length === 0 ? (
            <Alert tone="warning">
              No published offerings available for your account. Administrators need a published offering; lecturers need a course assignment.
            </Alert>
          ) : null}
          <Field id="topic-mode" label="Topic mode">
            <NativeSelect id="topic-mode" value={topicMode} onChange={(e: ChangeEvent<HTMLSelectElement>) => setTopicMode(e.target.value)}>
              <option value="new_module">New topic (module)</option>
              <option value="existing_module">Existing module</option>
              <option value="auto_segment">Let AI suggest topics (confirm later)</option>
            </NativeSelect>
          </Field>
          <Field id="module-title" label="Module / topic title">
            <Input id="module-title" value={moduleTitle} onChange={(e) => setModuleTitle(e.target.value)} placeholder="e.g. Unit 7 — Entrepreneurship in Nigeria" />
          </Field>
          <Field id="source-file" label="File">
            <Input id="source-file" type="file" accept=".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png,.webp" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          </Field>
          {message ? <Alert tone={status === "failed" ? "error" : "info"}>{message}</Alert> : null}
          <Button size="lg" onClick={() => void upload()} disabled={uploading || !offeringId || !file || courseOptions.length === 0} loading={uploading}>
            <Upload className="size-4" aria-hidden /> Upload and process with Gemini
          </Button>
          {jobId ? <p className="text-sm text-ink-muted">Job {jobId} — {status ?? "…"}</p> : null}
          {workspace === "admin" ? (
            <Button asChild variant="outline">
              <Link href="/admin/review?tab=lessons&status=draft">Review drafts</Link>
            </Button>
          ) : null}
          <Button asChild variant="outline">
            <Link href={backHref}>{backLabel}</Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
