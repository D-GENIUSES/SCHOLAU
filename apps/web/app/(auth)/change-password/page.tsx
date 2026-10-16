import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getServerSupabase } from "@/lib/supabase/server";
import { ResetPasswordForm } from "@/components/auth/reset-password-form";
export const metadata: Metadata = { title: "Change password" };
export default async function ChangePasswordPage() {
  const { data, error } = await (await getServerSupabase()).auth.getUser();
  if (error || !data.user) redirect("/sign-in?next=%2Fchange-password");
  return <ResetPasswordForm changing />;
}
