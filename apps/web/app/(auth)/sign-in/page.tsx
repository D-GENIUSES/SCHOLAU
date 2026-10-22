import type { Metadata } from "next";
import { param, type SearchParams } from "@/components/auth/params";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = {
  title: "Sign in to ScholAu",
  description: "Sign in to ScholAu to continue your university courses, practice tests and quiz battles.",
  alternates: { canonical: "https://scholau.com/sign-in" },
  robots: { index: true, follow: true },
};

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return <SignInForm next={param(sp.next)} deactivated={param(sp.deactivated) === "1"} linkError={param(sp.error) === "link"} oauthError={param(sp.error) === "oauth"} />;
}
