import { NextResponse } from "next/server";
import { generateQuizQuestionsFromSource } from "@scholau/core";
import { getRequestSupabase } from "@/lib/supabase/request";

export const runtime = "nodejs";
const MAX_BYTES = 10 * 1024 * 1024;

export async function POST(request: Request) {
  const client = await getRequestSupabase(request);
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });
  const form = await request.formData();
  const file = form.get("file");
  const quizId = String(form.get("quizId") ?? "");
  const offeringId = String(form.get("offeringId") ?? "");
  if (!(file instanceof File) || !quizId || !offeringId) {
    return NextResponse.json({ error: "Missing file or quiz context." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "File too large (10MB max)." }, { status: 400 });
  const mime = file.type || "application/octet-stream";
  const allowed = mime === "application/pdf" || mime.includes("word") || mime === "application/msword";
  if (!allowed) return NextResponse.json({ error: "Upload a PDF or Word document." }, { status: 400 });
  const buffer = Buffer.from(await file.arrayBuffer());
  let text: string | undefined;
  if (mime.includes("word") || mime === "application/msword") {
    try {
      const mammoth = await import("mammoth");
      const result = await mammoth.extractRawText({ buffer });
      text = result.value;
    } catch {
      return NextResponse.json({ error: "Could not read Word document." }, { status: 400 });
    }
  }
  try {
    const extracted = await generateQuizQuestionsFromSource({
      mimeType: mime === "application/pdf" ? mime : "text/plain",
      text,
      base64: text ? undefined : buffer.toString("base64"),
    });
    return NextResponse.json({ questions: extracted.questions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
