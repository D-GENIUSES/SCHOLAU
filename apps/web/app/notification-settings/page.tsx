import Link from "next/link";
import { requireSession } from "@/lib/session";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { NotificationsView } from "@/app/(student)/notifications/notifications-view";

export default async function NotificationSettingsPage() {
  const session = await requireSession("/notification-settings");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  const home = session.profile.roles.includes("admin") ? "/admin" : session.profile.roles.includes("lecturer") || !session.profile.roles.includes("student") ? "/lecturer" : "/home";
  return <main id="main" className="mx-auto grid max-w-2xl gap-3 px-4 py-5">
    <Link href={home} className="font-semibold text-brand-primary">Back to workspace</Link>
    <h1 className="text-2xl font-bold">Notification settings</h1>
    <NotificationSettings owner={session.userId} />
    <section aria-label="Notification inbox"><NotificationsView /></section>
  </main>;
}
