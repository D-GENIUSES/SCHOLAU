import type { Metadata } from "next";
import { param, type SearchParams } from "@/components/auth/params";
import { SignInForm } from "@/components/auth/sign-in-form";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { authContext, authHref } from "@/components/auth/auth-navigation";
import { AuthMethodOptions } from "@/components/auth/auth-method-options";
import { AuthNotices } from "@/components/auth/auth-notices";

export const metadata: Metadata = {
  title: "Sign in to ScholAu",
  description: "Sign in to ScholAu to continue your university courses, practice tests and quiz battles.",
  alternates: { canonical: "https://scholau.com/sign-in" },
  robots: { index: true, follow: true },
};

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const context = authContext(sp);
  const email = param(sp.method) === "email";
  return <div className="auth-method-page">
    {email ? <Link href={authHref("/sign-in", context)} className="auth-method-back"><ArrowLeft size={16} aria-hidden="true" />Sign-in options</Link> : null}
    <AuthNotices {...context} />
    {email ? <SignInForm next={context.next} context={context} /> : <AuthMethodOptions mode="sign-in" context={context} />}
  </div>;
}
