import { redirect } from "next/navigation";
import type { LecturerOffering } from "@scholau/core";
import { LecturerDashboard } from "@/components/lecturer/dashboard";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { lecturerApi } from "@/lib/lecturer-api";
import { requireSession } from "@/lib/session";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function LecturerPage() {
  const session = await requireSession("/lecturer");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  if (!session.profile.roles.includes("lecturer")) redirect("/lecturer/application");

  const api = lecturerApi(await getServerSupabase());
  let courseItems: LecturerOffering[];
  try {
    const courses = await api.courses();
    courseItems = Array.isArray(courses.items) ? courses.items : [];
  } catch {
    return <ServiceUnavailable reference="SA-LECTURER-COURSES" message="Your teaching assignments could not be loaded. Please try again." />;
  }

  return <LecturerDashboard courses={courseItems} />;
}
