import type { Metadata } from "next";
import { param, type SearchParams } from "@/components/auth/params";
import { AcademicProfileStep } from "@/components/onboarding/academic-profile-step";

export const metadata: Metadata = { title: "Academic profile" };

export default async function OnboardingPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return <AcademicProfileStep changeRequested={param(sp.change) === "1"} />;
}
