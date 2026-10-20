import { getAppVersion } from "@/lib/app-version";
export const dynamic = "force-dynamic";
export function GET() {
  return Response.json({ version: getAppVersion(), splash: "blue-orbit-v4" }, { headers: {
    "Cache-Control": "no-store, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
  } });
}
