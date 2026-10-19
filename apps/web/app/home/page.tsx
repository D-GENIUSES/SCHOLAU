import type { Metadata } from "next";
import { Suspense } from "react";
import { GuestExperience } from "@/components/guest/guest-experience";
import { HomeView } from "@/components/home/home-view";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { AppShell } from "@/components/shell/app-shell";
import { LoadingState } from "@/components/ui/states";
import { requireOnboardedSession } from "@/lib/session";
import { getServerSupabase } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Home" };

/** Public app entry. Guests do not call account RPCs or subscribe to user signals. */
export default async function HomePage() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getClaims().catch(() => ({ data: null }));
  if (!data?.claims?.sub) {
    return <Suspense fallback={<LoadingState label="Opening ScholAu…" />}><GuestExperience /></Suspense>;
  }
  const session = await requireOnboardedSession("/home");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  return <AppShell isAdmin={session.profile.roles.includes("admin")}><HomeView /></AppShell>;
}
