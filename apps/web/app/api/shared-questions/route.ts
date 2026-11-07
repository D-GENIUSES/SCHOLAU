import { SITE_URL } from "@/lib/seo";
import { createStudyLink, sourceSchema } from "@/lib/shared-study-server";

export async function POST(request: Request) {
  const input = sourceSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return new Response(null, { status: 400 });
  try {
    const link = await createStudyLink(input.data);
    if (!link) return new Response(null, { status: 404 });
    const url = new URL(`/q/${link.token}`, process.env.NODE_ENV === "development" ? request.url : SITE_URL).toString();
    return Response.json({ url, topic: link.topic });
  } catch {
    return new Response(null, { status: 503 });
  }
}