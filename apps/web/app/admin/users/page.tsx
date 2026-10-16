import type { Metadata } from "next";
import { requireSession } from "@/lib/session";
import { getServerSupabase } from "@/lib/supabase/server";
import { AdminCreateUser } from "@/components/admin/admin-create-user";
import { PageHeader } from "@/components/ui/misc";
import { ServiceUnavailable } from "@/components/service-unavailable";

export const metadata: Metadata = { title: "Add users" };
export default async function AdminUsersPage() {
  const session = await requireSession("/admin/users");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  if (!session.profile.roles.includes("admin")) return null;
  const { error } = await (await getServerSupabase()).rpc("admin_user_creation_access_v1");
  const enabled = !error && Boolean(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY);
  return <><PageHeader eyebrow="Administration" title="Add users" description="Create a student or lecturer account with a name, email and initial password." /><AdminCreateUser enabled={enabled} /></>;
}
