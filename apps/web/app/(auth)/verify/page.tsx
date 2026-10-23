import type { Metadata } from "next";
import { param, type SearchParams } from "@/components/auth/params";
import { VerifyPanel } from "@/components/auth/verify-panel";

export const metadata: Metadata = { title: "Check your email" };

export default async function VerifyPage({ searchParams }: { searchParams: SearchParams }) {
  const sp = await searchParams;
  const email = param(sp.email)?.trim();
  return <VerifyPanel email={email || undefined} lecturer={param(sp.kind) === "lecturer"} retry={param(sp.status) === "retry"} />;
}
