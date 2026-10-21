import type { Metadata } from "next";
import { Suspense } from "react";
import { GuestExperience } from "@/components/guest/guest-experience";
import { HomeView } from "@/components/home/home-view";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { AppShell } from "@/components/shell/app-shell";
import { LoadingState } from "@/components/ui/states";
import { requireOnboardedSession } from "@/lib/session";
import { getServerSupabase } from "@/lib/supabase/server";
import { publicPages, SITE_URL } from "@/lib/seo";

export async function generateMetadata({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }): Promise<Metadata> {
  const params = await searchParams;
  const view = typeof params.view === "string" ? params.view : "home";
  const page = publicPages.find((entry) => entry.view === view) ?? publicPages[0];
  return {
    title: view === "home" ? { absolute: page.title } : page.title,
    description: page.description,
    alternates: { canonical: `${SITE_URL}${page.path}` },
    robots: { index: publicPages.some((entry) => entry.view === view), follow: true },
    openGraph: { type: "website", siteName: "ScholAu", title: page.title, description: page.description, url: `${SITE_URL}${page.path}`, images: ["/opengraph-image.png"] },
    twitter: { card: "summary_large_image", title: page.title, description: page.description, images: ["/twitter-image.png"] },
  };
}

/** Public app entry. Guests do not call account RPCs or subscribe to user signals. */
export default async function HomePage() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getClaims().catch(() => ({ data: null }));
  if (!data?.claims?.sub) {
    return <Suspense fallback={<LoadingState variant="home" label="Opening ScholAu…" />}><GuestExperience /></Suspense>;
  }
  const session = await requireOnboardedSession("/home");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  return <AppShell userId={session.userId} isAdmin={session.profile.roles.includes("admin")}><HomeView owner={session.userId} /></AppShell>;
}
