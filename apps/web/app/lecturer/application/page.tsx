import { LecturerApplicationPanel } from "@/components/auth/lecturer-application-panel";
import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
export default async function ApplicationPage() {
  const session = await requireSession("/lecturer/application");
  if (session.kind === "ok" && session.profile.roles.includes("lecturer")) redirect("/lecturer");
  return <LecturerApplicationPanel />;
}
