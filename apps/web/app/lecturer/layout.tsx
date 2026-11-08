import type { Metadata } from "next";
import type { ReactNode } from "react";
import { LecturerWorkspaceShell } from "@/components/lecturer/workspace-shell";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { requireSession } from "@/lib/session";

export const metadata: Metadata = { title: "Lecturer workspace", robots: { index: false, follow: false } };

export default async function LecturerLayout({ children }: { children: ReactNode }) {
  const session = await requireSession("/lecturer/application");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  const { profile } = session;
  return (
    <LecturerWorkspaceShell name={profile.display_name} avatar={profile.avatar_path} canTeach={profile.roles.includes("lecturer") || profile.roles.includes("admin")}>
      {children}
    </LecturerWorkspaceShell>
  );
}
