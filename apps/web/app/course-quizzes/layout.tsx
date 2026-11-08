import type { ReactNode } from "react";
import Link from "next/link";
import { requireSession } from "@/lib/session";
import { ServiceUnavailable } from "@/components/service-unavailable";

export default async function CourseQuizLayout({ children }: { children: ReactNode }) {
  const session = await requireSession("/course-quizzes/");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  const home = session.profile.roles.includes("lecturer") ? "/lecturer" : "/home";
  return (
    <div className="min-h-dvh bg-surface-page">
      <header className="border-b border-line p-4">
        <Link className="inline-flex min-h-11 items-center font-bold" href={home}>ScholAu · My courses</Link>
      </header>
      <main id="main" className="mx-auto max-w-4xl px-4 py-6 sm:px-6">{children}</main>
    </div>
  );
}
