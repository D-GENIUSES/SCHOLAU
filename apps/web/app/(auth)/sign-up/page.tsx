import type { Metadata } from "next";
import Link from "next/link";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { LecturerSignUpForm } from "@/components/auth/lecturer-sign-up-form";
import { AuthHeading } from "@/components/auth/auth-heading";
import { param, type SearchParams } from "@/components/auth/params";

export const metadata: Metadata = {
  title: "Create a ScholAu account",
  description: "Create a ScholAu student account to study, practise and compete, or apply for lecturer access.",
  alternates: { canonical: "https://scholau.com/sign-up" },
  robots: { index: true, follow: true },
};
export default async function SignUpPage({ searchParams }: { searchParams: SearchParams }) {
  const role = param((await searchParams).role);
  if (role === "student") return <><Link href="/sign-up" className="mb-5 inline-block text-sm font-semibold text-brand-primary">← Account options</Link><SignUpForm /></>;
  if (role === "lecturer") return <LecturerSignUpForm />;
  return <>
    <AuthHeading title="Create an account" description="Select the account you need." />
    <div className="auth-role-options">
      <Link href="/sign-up?role=student" className="auth-role-option"><div><h2 className="font-bold">Sign up as a student</h2><p className="mt-1 text-sm text-ink-muted">Read course lessons, take tests, and save your progress.</p></div></Link>
      <Link href="/sign-up?role=lecturer" className="auth-role-option"><div><h2 className="font-bold">Apply as a lecturer</h2><p className="mt-1 text-sm text-ink-muted">Submit your teaching details for review. Lecturer access requires administrator approval.</p></div></Link>
    </div>
    <p className="mt-6 text-center text-sm text-ink-muted">Already have an account? <Link href="/sign-in" className="font-semibold text-brand-primary underline">Sign in</Link></p>
  </>;
}
