import type { Metadata } from "next";
import { param, type SearchParams } from "@/components/auth/params";
import { SignInForm } from "@/components/auth/sign-in-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  return <SignInForm next={param(sp.next)} deactivated={param(sp.deactivated) === "1"} linkError={param(sp.error) === "link"} />;
}
