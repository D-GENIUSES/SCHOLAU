import type { Metadata } from "next";
import Link from "next/link";
import Image from "next/image";
import { ArrowUpRight, GraduationCap, Presentation } from "lucide-react";
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
    <div className="auth-role-options" aria-label="Choose an account type">
      <Link href="/sign-up?role=student" className="auth-role-option auth-role-student">
        <span className="auth-role-art" aria-hidden="true">
          <Image src="/illustrations/signup-student.jpg" alt="" fill sizes="(max-width: 639px) 40vw, 190px" priority />
          <span className="auth-role-art-badge"><GraduationCap size={17} strokeWidth={1.8} /></span>
        </span>
        <span className="auth-role-copy"><span className="auth-role-eyebrow">YOUR LEARNING SPACE</span><span className="auth-role-title">Student</span><span className="auth-role-description">Study courses, practise and track your progress.</span><span className="auth-role-action">Create student account <ArrowUpRight size={16} aria-hidden="true" /></span></span>
      </Link>
      <Link href="/sign-up?role=lecturer" className="auth-role-option auth-role-lecturer">
        <span className="auth-role-art" aria-hidden="true">
          <Image src="/illustrations/signup-lecturer.jpg" alt="" fill sizes="(max-width: 639px) 40vw, 190px" priority />
          <span className="auth-role-art-badge"><Presentation size={17} strokeWidth={1.8} /></span>
        </span>
        <span className="auth-role-copy"><span className="auth-role-eyebrow">TEACH &amp; CONTRIBUTE</span><span className="auth-role-title">Lecturer</span><span className="auth-role-description">Share your teaching details for an access review.</span><span className="auth-role-action">Apply for lecturer access <ArrowUpRight size={16} aria-hidden="true" /></span></span>
      </Link>
    </div>
    <p className="mt-6 text-center text-sm text-ink-muted">Already have an account? <Link href="/sign-in" className="font-semibold text-brand-primary underline">Sign in</Link></p>
  </>;
}
