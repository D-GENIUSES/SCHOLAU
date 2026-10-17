import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getServerApi, getServerSupabase } from "@/lib/supabase/server";
import { isApiError } from "@scholau/api";
import { ProfilePhotoEditor } from "@/components/profile/profile-photo-editor";
import { PageHeader } from "@/components/ui/misc";
import { ServiceUnavailable } from "@/components/service-unavailable";

export const metadata: Metadata = { title: "Profile photo", robots: { index: false, follow: false } };
export default async function ProfilePhotoPage() {
  const { data, error } = await (await getServerSupabase()).auth.getUser();
  if (error || !data.user) redirect("/sign-in?next=%2Faccount%2Fphoto");
  let profile;
  try { profile = await (await getServerApi()).getMyProfile(); }
  catch (error) {
    if (isApiError(error, "FORBIDDEN")) redirect("/auth/deactivated");
    return <ServiceUnavailable reference="SA-PROFILE-PHOTO" message="Your account could not be loaded. Please try again." />;
  }
  return <main id="main" className="mx-auto w-full max-w-xl px-4 py-8"><Link href="/auth/continue" className="mb-6 inline-flex min-h-11 items-center text-sm font-semibold text-brand-primary">Back to your account</Link><PageHeader title="Profile photo" description="Choose a photo, adjust the crop and preview before saving." /><div className="rounded-card border border-line bg-surface-card p-5"><ProfilePhotoEditor profile={profile} /></div></main>;
}
