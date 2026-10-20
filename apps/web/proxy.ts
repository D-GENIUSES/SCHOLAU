import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|push-sw.js|favicon.ico|icon.svg|apple-icon.png|opengraph-image|twitter-image|manifest.webmanifest|brand/|icons/|sounds/|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
