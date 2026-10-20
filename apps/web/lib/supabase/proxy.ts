import { isBearerApiRequest } from "./request-auth";
import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { SUPABASE_ANON_KEY, SUPABASE_URL } from "@/lib/env";
import { safeNext } from "@/lib/utils";

const PUBLIC_PATHS = ["/", "/home", "/sign-in", "/sign-up", "/verify", "/recover", "/reset-password", "/privacy", "/terms", "/auth", "/offline"];
const AUTH_PAGES = ["/sign-in", "/sign-up"];

function isPublic(pathname: string) {
  return PUBLIC_PATHS.some((p) => pathname === p || (p !== "/" && pathname.startsWith(`${p}/`)));
}

/** Refreshes the Supabase session cookie and gates protected routes on authentication. */
export async function updateSession(request: NextRequest) {
  if (isBearerApiRequest(request)) return NextResponse.next({ request });
  if (process.env.NODE_ENV === "development" && request.nextUrl.pathname === "/design-preview") {
    return NextResponse.next({ request });
  }
  let response = NextResponse.next({ request });
  const redirectWithCookies = (url: URL) => {
    const redirected = NextResponse.redirect(url);
    response.cookies.getAll().forEach((cookie) => redirected.cookies.set(cookie));
    redirected.headers.set("Cache-Control", "private, no-store");
    return redirected;
  };

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_ANON_KEY || "missing-anon-key", {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (toSet) => {
        toSet.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        toSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  let userId: string | null = null;
  try {
    const { data } = await supabase.auth.getClaims();
    userId = (data?.claims?.sub as string | undefined) ?? null;
  } catch {
    userId = null;
  }

  const { pathname, search } = request.nextUrl;

  if (!userId && !isPublic(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/sign-in";
    url.search = `?next=${encodeURIComponent(pathname + search)}`;
    return redirectWithCookies(url);
  }

  if (userId && AUTH_PAGES.includes(pathname)) {
    const next = safeNext(request.nextUrl.searchParams.get("next"), "/auth/continue");
    const url = new URL(next, request.url);
    // Never bounce between the auth page and itself, even after URL normalization.
    if (AUTH_PAGES.includes(url.pathname)) {
      url.pathname = "/auth/continue";
      url.search = "";
      url.hash = "";
    }
    return redirectWithCookies(url);
  }

  return response;
}
