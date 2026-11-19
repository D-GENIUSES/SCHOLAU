import { NextResponse } from "next/server";
import { generateGeminiJson } from "@scholau/core/ingestion";
import { getRequestSupabase } from "@/lib/supabase/request";

export const runtime = "nodejs";
export const maxDuration = 30;

const prompt = `Read the exam-paper header in this cropped image. Extract only the student's name, department/programme, matriculation number, and the handwritten mark written in red ink. Preserve the mark exactly as written (for example "15", "15/20", or "A"); never calculate, infer, or normalize a mark. Do not treat printed questions, totals, or other handwriting as the mark. If a field is missing or uncertain, return null for it. Return JSON only with keys student_name, department, matric_number, score, confidence. confidence is a number from 0 to 1 describing confidence in all four fields.`;

export async function POST(request: Request) {
  const client = await getRequestSupabase(request);
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Sign in to scan exam papers." }, { status: 401 });

  let body: unknown;
  try { body = await request.json(); } catch { return NextResponse.json({ error: "Invalid request." }, { status: 400 }); }
  const payload = (body ?? {}) as Record<string, unknown>;
  const offeringId = typeof payload.offeringId === "string" ? payload.offeringId : "";
  const image = typeof payload.image === "string" ? payload.image : "";
  const match = /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=]+)$/.exec(image);
  if (!offeringId || !match || match[2]!.length > 5_500_000) return NextResponse.json({ error: "Choose a course and a clear exam-header photo under 4 MB." }, { status: 400 });

  const { data: courses, error: courseError } = await client.rpc("get_my_lecturer_courses_v1");
  if (courseError) return NextResponse.json({ error: "Could not verify your teaching course." }, { status: 403 });
  const items = Array.isArray(courses?.items) ? courses.items as Array<{ id: string }> : [];
  if (!items.some(course => course.id === offeringId)) return NextResponse.json({ error: "You are not assigned to this course." }, { status: 403 });

  try {
    const result = await generateGeminiJson([
      { text: prompt },
      { inlineData: { mimeType: match[1]!, data: match[2]! } },
    ]) as Record<string, unknown>;
    const clean = (value: unknown, max: number) => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
    const confidence = typeof result.confidence === "number" && Number.isFinite(result.confidence) ? Math.max(0, Math.min(1, result.confidence)) : 0;
    return NextResponse.json({
      student_name: clean(result.student_name, 160),
      department: clean(result.department, 160),
      matric_number: clean(result.matric_number, 80),
      score: clean(result.score, 40),
      confidence,
    });
  } catch (error) {
    const message = error instanceof Error && error.message.includes("GEMINI_NOT_CONFIGURED")
      ? "Exam scanning is not configured yet. Add the Gemini API key to the server environment."
      : "Could not read this exam header. Try a clearer photo or enter the details manually.";
    return NextResponse.json({ error: message }, { status: 503 });
  }
}
