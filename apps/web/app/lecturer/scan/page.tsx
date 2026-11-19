import { redirect } from "next/navigation";
import type { LecturerOffering } from "@scholau/core";
import { LecturerScanWorkspace } from "@/components/lecturer/scan-workspace";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { lecturerApi } from "@/lib/lecturer-api";
import { requireSession } from "@/lib/session";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function LecturerScanPage() {
  const session = await requireSession("/lecturer/scan");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  if (!session.profile.roles.includes("lecturer")) redirect("/lecturer/application");
  let courses: LecturerOffering[];
  try {
    const result = await lecturerApi(await getServerSupabase()).courses();
    courses = Array.isArray(result.items) ? result.items : [];
  } catch {
    return <ServiceUnavailable reference="SA-LECTURER-SCAN" message="Your teaching courses could not be loaded. Please try again." />;
  }
  return <LecturerScanWorkspace courses={courses} />;
}
