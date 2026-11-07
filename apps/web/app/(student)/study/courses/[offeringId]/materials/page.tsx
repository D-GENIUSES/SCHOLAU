"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { NativeSelect } from "@/components/ui/input";
import { getBrowserSupabase } from "@/lib/supabase/browser";

type Submitted = { id: string; filename: string; status: string; reviewer_note: string | null };
type CurriculumModule = {
  id: string;
  title: string;
  position: number;
  lessons: { lesson_id: string; position: number; title: string }[];
};

export default function SuggestCourseMaterial() {
  const { offeringId } = useParams<{ offeringId: string }>();
  const [file, setFile] = useState<File | null>(null);
  const [notes, setNotes] = useState("");
  const [sending, setSending] = useState(false);
  const [message, setMessage] = useState("");
  const [history, setHistory] = useState<Submitted[]>([]);
  const [modules, setModules] = useState<CurriculumModule[]>([]);
  const [moduleId, setModuleId] = useState("");
  const [lessonId, setLessonId] = useState("");
  const [scope, setScope] = useState<"topic" | "lesson">("topic");

  useEffect(() => {
    void (async () => {
      const { data } = await getBrowserSupabase().rpc("get_enrolled_course_curriculum_v1", { p_offering_id: offeringId });
      const list = (data?.modules ?? []) as CurriculumModule[];
      setModules(list);
      if (list[0]) setModuleId(list[0].id);
    })();
  }, [offeringId]);

  const selectedModule = modules.find((m) => m.id === moduleId);

  const historyRefresh = async () => {
    const { data } = await getBrowserSupabase().rpc("list_student_materials_v1", { p_offering_id: offeringId });
    setHistory(data?.items ?? []);
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!file || sending) return;
    if (file.size > 50 * 1024 * 1024) {
      setMessage("Choose a file that is 50 MB or smaller.");
      return;
    }
    if (!moduleId) {
      setMessage("Choose a topic for this material.");
      return;
    }
    if (scope === "lesson" && !lessonId) {
      setMessage("Choose a lesson or switch to whole-topic upload.");
      return;
    }
    setSending(true);
    setMessage("");
    try {
      const endpoint = "/api/student-materials?offeringId=" + encodeURIComponent(offeringId);
      const prepared = await fetch(endpoint, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "prepare", filename: file.name, bytes: file.size }),
      });
      const upload = await prepared.json();
      if (!prepared.ok) throw new Error(upload.message ?? "Could not start upload.");
      const stored = await fetch(upload.uploadUrl, {
        method: "PUT", headers: { "Content-Type": upload.mimeType }, body: file,
      });
      if (!stored.ok) throw new Error("The private file upload failed. Please try again.");
      const res = await fetch(endpoint, {
        method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "complete",
          ticket: upload.ticket,
          notes,
          moduleId,
          lessonId: scope === "lesson" ? lessonId : null,
          ingestionScope: scope,
        }),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.message ?? "Could not submit uploaded file.");
      setFile(null);
      setNotes("");
      setMessage("Submitted for lecturer or administrator review. This will not publish anything automatically.");
      await historyRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not submit file.");
    } finally {
      setSending(false);
    }
  }

  return (
    <main className="mx-auto max-w-2xl space-y-5">
      <Link href={"/study/courses/" + offeringId} className="text-brand-primary underline">Back to course</Link>
      <h1 className="text-2xl font-bold">Suggest course material</h1>
      <p>Upload a lecture note or relevant source for lecturer approval. After approval, ScholAu can generate draft lessons and practice questions. Nothing becomes a student-facing lesson until separately reviewed and published.</p>
      <form onSubmit={submit} className="space-y-4 rounded-card border border-line p-5">
        <label className="block space-y-2">
          <span className="font-semibold">Topic</span>
          <NativeSelect value={moduleId} onChange={(e) => { setModuleId(e.target.value); setLessonId(""); }}>
            <option value="">Select topic…</option>
            {modules.map((m) => (
              <option key={m.id} value={m.id}>
                {m.title}
              </option>
            ))}
          </NativeSelect>
        </label>
        <label className="block space-y-2">
          <span className="font-semibold">Upload target</span>
          <NativeSelect value={scope} onChange={(e) => setScope(e.target.value as "topic" | "lesson")}>
            <option value="topic">Whole topic — split across lessons after approval</option>
            <option value="lesson">One lesson</option>
          </NativeSelect>
        </label>
        {scope === "lesson" ? (
          <label className="block space-y-2">
            <span className="font-semibold">Lesson</span>
            <NativeSelect value={lessonId} onChange={(e) => setLessonId(e.target.value)}>
              <option value="">Select lesson…</option>
              {selectedModule?.lessons.map((l) => (
                <option key={l.lesson_id} value={l.lesson_id}>
                  {l.title}
                </option>
              ))}
            </NativeSelect>
          </label>
        ) : null}
        <label className="block space-y-2">
          <span className="font-semibold">Material file (up to 50 MB)</span>
          <input type="file" className="block w-full text-sm" accept=".pdf,.docx,.pptx,.txt,.jpg,.jpeg,.png,.webp"
            required onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
        </label>
        <label className="block space-y-2">
          <span className="font-semibold">Why is this useful? (optional)</span>
          <textarea className="min-h-24 w-full rounded-control border border-line p-3" maxLength={500}
            value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Relevant topic, lecturer, or page references" />
        </label>
        <p className="text-sm text-ink-muted">Only submit files you have permission to share. Avoid documents containing private student information.</p>
        <Button type="submit" disabled={!file || sending} loading={sending}>Submit for review</Button>
        {message ? <p role="status" className="text-sm">{message}</p> : null}
      </form>
      <section className="space-y-2">
        <h2 className="text-lg font-bold">Your submissions</h2>
        <Button variant="outline" size="sm" onClick={() => void historyRefresh()}>Refresh submissions</Button>
        {history.map((item) => <div key={item.id} className="rounded-control border border-line p-3 text-sm">
          <strong>{item.filename}</strong> · {item.status}
          {item.reviewer_note ? <p>{item.reviewer_note}</p> : null}
        </div>)}
      </section>
    </main>
  );
}
