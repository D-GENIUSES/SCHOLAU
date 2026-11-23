import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  if (["/sitemap.xml", "/robots.txt", "/ads.txt"].includes(request.nextUrl.pathname)) return NextResponse.next();
  // Public routes do not need an auth lookup in the request proxy. This avoids
  // making the landing, course catalog, and shared-question pages wait on auth.
  if (["/", "/home", "/sign-in", "/sign-up", "/verify", "/recover", "/reset-password", "/privacy", "/terms", "/offline", "/courses", "/q"].includes(request.nextUrl.pathname)
    || request.nextUrl.pathname.startsWith("/courses/")
    || request.nextUrl.pathname.startsWith("/q/")) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|push-sw.js|favicon.ico|icon.svg|apple-icon.png|opengraph-image|twitter-image|manifest.webmanifest|brand/|icons/|sounds/|robots.txt|ads.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
