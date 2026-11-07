import { z } from "zod";
import { answerSharedStudyQuestion } from "@/lib/shared-study-server";

const submission = z.object({ answer: z.string().trim().min(1).max(500) });

export async function POST(request: Request, { params }: { params: Promise<{ token: string }> }) {
  const input = submission.safeParse(await request.json().catch(() => null));
  if (!input.success) return new Response(null, { status: 400 });
  try {
    const { token } = await params;
    const feedback = await answerSharedStudyQuestion(token, input.data.answer);
    return feedback
      ? Response.json(feedback, { headers: { "Cache-Control": "no-store" } })
      : new Response(null, { status: 404 });
  } catch {
    return new Response(null, { status: 503 });
  }
}