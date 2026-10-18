import { redirect } from "next/navigation";
import { requireSession } from "@/lib/session";
import { getServerSupabase } from "@/lib/supabase/server";
import { ServiceUnavailable } from "@/components/service-unavailable";

export default async function OpenNotification({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const session = await requireSession(`/notification-open/${encodeURIComponent(id)}`);
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  if (!/^[0-9a-f-]{36}$/i.test(id)) redirect("/notification-settings");
  const { data, error } = await (await getServerSupabase()).rpc("open_notification_v1", { p_id: id });
  const target: unknown = !error ? data?.target : null;
  redirect(typeof target === "string" && /^\/[A-Za-z0-9/_-]*$/.test(target) && !target.startsWith("//") ? target : "/notification-settings");
}
