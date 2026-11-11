import { NextResponse } from "next/server";
import { parseRpcError } from "@scholau/api";
import { generateQuizQuestionsFromTopics } from "@scholau/core/ingestion";
import type { LecturerQuizList } from "@scholau/core";
import { getRequestSupabase } from "@/lib/supabase/request";

export const runtime = "nodejs";
export const maxDuration = 120;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

type GenerationSources = {
  course_code?: string;
  sources?: Array<{
    lesson_id?: string;
    module_title: string;
    lesson_title: string;
    objective?: string;
    text: string;
  }>;
};

function asUuidList(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((item) => String(item)).filter((id) => UUID_RE.test(id)))];
}

export async function POST(request: Request) {
  const client = await getRequestSupabase(request);
  const { data: auth } = await client.auth.getUser();
  if (!auth.user) return NextResponse.json({ error: "Unauthorised" }, { status: 401 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const payload = (body ?? {}) as Record<string, unknown>;
  const offeringId = String(payload.offeringId ?? "");
  const quizId = String(payload.quizId ?? "");
  const moduleIds = asUuidList(payload.moduleIds);
  const lessonIds = asUuidList(payload.lessonIds);
  const questionCount = Number(payload.questionCount);

  if (!offeringId || !UUID_RE.test(offeringId)) {
    return NextResponse.json({ error: "Missing course context." }, { status: 400 });
  }
  if (moduleIds.length + lessonIds.length < 1) {
    return NextResponse.json({ error: "Select at least one topic or lesson." }, { status: 400 });
  }
  if (!Number.isInteger(questionCount) || questionCount < 10 || questionCount > 30) {
    return NextResponse.json({ error: "Choose between 10 and 30 questions." }, { status: 400 });
  }

  const { data: listRaw, error: listError, status: listStatus } = await client.rpc("list_course_quizzes_v1", {
    p_offering_id: offeringId,
    p_offset: 0,
  });
  if (listError) {
    const parsed = parseRpcError(listError, listStatus);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status ?? 403 });
  }
  const list = listRaw as LecturerQuizList;
  if (!list?.teacher) {
    return NextResponse.json({ error: "You are not assigned to teach this course." }, { status: 403 });
  }

  if (quizId) {
    if (!UUID_RE.test(quizId)) {
      return NextResponse.json({ error: "Invalid quiz id." }, { status: 400 });
    }
    const { data: detailRaw, error: detailError, status: detailStatus } = await client.rpc("get_course_quiz_v1", {
      p_id: quizId,
    });
    if (!detailError && detailRaw) {
      const detail = detailRaw as { quiz?: { state?: string } };
      if (detail.quiz?.state && detail.quiz.state !== "draft") {
        return NextResponse.json({ error: "Generation is only available while the quiz is a draft." }, { status: 409 });
      }
    } else if (detailError) {
      const parsed = parseRpcError(detailError, detailStatus);
      if (parsed.code !== "NOT_FOUND") {
        return NextResponse.json({ error: parsed.message }, { status: parsed.status ?? 403 });
      }
    }
  }

  const { data: sourcesRaw, error: sourcesError, status: sourcesStatus } = await client.rpc(
    "get_lecturer_quiz_generation_sources_v1",
    {
      p_offering_id: offeringId,
      p_module_ids: moduleIds,
      p_lesson_ids: lessonIds,
    },
  );
  if (sourcesError) {
    const parsed = parseRpcError(sourcesError, sourcesStatus);
    return NextResponse.json({ error: parsed.message }, { status: parsed.status ?? 400 });
  }

  const sourcesPayload = sourcesRaw as GenerationSources;
  const sources = sourcesPayload?.sources ?? [];
  const courseCode = sourcesPayload?.course_code?.trim();
  if (!courseCode || !sources.length) {
    return NextResponse.json({ error: "No published lesson content for the selected topics." }, { status: 400 });
  }

  try {
    const extracted = await generateQuizQuestionsFromTopics({
      courseCode,
      sources: sources.map((source) => ({
        ...source,
        objective: source.objective ?? "",
      })),
      questionCount,
    });
    return NextResponse.json({ questions: extracted.questions });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Generation failed";
    const status = message.includes("GEMINI_NOT_CONFIGURED") ? 503 : 502;
    return NextResponse.json({ error: message }, { status });
  }
}
