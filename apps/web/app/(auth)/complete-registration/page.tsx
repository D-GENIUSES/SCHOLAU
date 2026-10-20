import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CompleteRegistrationForm } from "@/components/auth/complete-registration-form";
import { getServerSupabase } from "@/lib/supabase/server";
import { accountDestination } from "@/lib/auth-destination";
import { ServiceUnavailable } from "@/components/service-unavailable";

export const metadata: Metadata = { title: "Complete registration" };

export default async function CompleteRegistrationPage() {
  const client = await getServerSupabase();
  const { data, error } = await client.auth.getUser();
  if (error || !data.user) redirect("/sign-in");
  const status = await client.rpc("get_my_registration_status_v1");
  if (status.error) return <ServiceUnavailable reference="SA-REGISTRATION" message="Registration is temporarily unavailable. Please try again shortly." />;
  if (!status.data?.pending) redirect(await accountDestination());
  return <CompleteRegistrationForm />;
}
