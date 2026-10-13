import type { Metadata } from "next";
import { ProfileView } from "@/components/profile/profile-view";
import { getServerSupabase } from "@/lib/supabase/server";
import { readRegistrationAcademic } from "@scholau/core";

export const metadata: Metadata = { title: "Profile" };

export default async function ProfilePage() {
  const supabase = await getServerSupabase();
  const { data } = await supabase.auth.getClaims().catch(() => ({ data: null }));
  return <ProfileView registration={readRegistrationAcademic(data?.claims?.user_metadata)} />;
}
