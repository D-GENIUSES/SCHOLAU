import { redirect } from "next/navigation";
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
  const [courses, submissions] = await Promise.allSettled([api.courses(), api.studentSubmissions()]);
  if (courses.status === "rejected") {
    return <ServiceUnavailable reference="SA-LECTURER-COURSES" message="Your teaching assignments could not be loaded. Please try again." />;
  }

  const courseItems = Array.isArray(courses.value.items) ? courses.value.items : [];
  const offeringIds = new Set(courseItems.map(({ id }) => id));
  const submissionItems = submissions.status === "fulfilled" && Array.isArray(submissions.value.items)
    ? submissions.value.items
    : [];
  const pending = submissionItems.filter((item) => item.status === "pending" && offeringIds.has(item.offering_id)).length;

  return <LecturerDashboard courses={courseItems} pendingSubmissions={pending} />;
}
