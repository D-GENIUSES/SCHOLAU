import { SITE_URL } from "@/lib/seo";
import { type StudyShareErrorCode } from "@/lib/shared-study";
import { canShareBankVersions, createStudyLink, sourceSchema } from "@/lib/shared-study-server";

function studyLinkUrl(token: string, request: Request) {
  return new URL(`/q/${token}`, process.env.NODE_ENV === "development" ? request.url : SITE_URL).toString();
}

export async function GET(request: Request) {
  const raw = new URL(request.url).searchParams.get("versions") ?? "";
  const versions = raw.split(",").map((value) => value.trim()).filter(Boolean);
  if (!versions.length) return new Response(null, { status: 400 });
  try {
    const shareable = await canShareBankVersions(versions);
    return Response.json({ versions: shareable });
  } catch {
    return new Response(null, { status: 503 });
  }
}

export async function POST(request: Request) {
  const input = sourceSchema.safeParse(await request.json().catch(() => null));
  if (!input.success) return Response.json({ code: "not_shareable" satisfies StudyShareErrorCode }, { status: 400 });
  try {
    const result = await createStudyLink(input.data);
    if (!result.ok) {
      const status = result.reason === "unauthenticated" ? 401 : result.reason === "not_enrolled" ? 403 : 404;
      return Response.json({ code: result.reason }, { status });
    }
    const url = studyLinkUrl(result.token, request);
    return Response.json({ url, topic: result.topic });
  } catch {
    return new Response(null, { status: 503 });
  }
}
