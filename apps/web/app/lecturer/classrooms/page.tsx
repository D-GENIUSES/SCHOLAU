import { redirect } from "next/navigation";
import { LecturerClassrooms } from "@/components/classrooms/lecturer-classrooms";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { lecturerApi } from "@/lib/lecturer-api";
import { requireSession } from "@/lib/session";
import { getServerSupabase } from "@/lib/supabase/server";

export default async function LecturerClassroomsPage() {
  const session = await requireSession("/lecturer/classrooms");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  if (!session.profile.roles.includes("lecturer")) redirect("/lecturer/application");
  let courses;
  try {
    courses = await lecturerApi(await getServerSupabase()).courses();
  } catch {
    return <ServiceUnavailable reference="SA-LECTURER-CLASSROOMS" message="Your teaching courses could not be loaded. Please try again." />;
  }
  return <LecturerClassrooms courses={courses.items} />;
}
