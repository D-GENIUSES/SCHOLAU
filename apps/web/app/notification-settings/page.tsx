import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireSession } from "@/lib/session";
import { ServiceUnavailable } from "@/components/service-unavailable";
import { NotificationSettings } from "@/components/notifications/notification-settings";
import { NotificationsView } from "@/app/(student)/notifications/notifications-view";

export default async function NotificationSettingsPage() {
  const session = await requireSession("/notification-settings");
  if (session.kind === "unavailable") return <ServiceUnavailable reference={session.reference} message={session.message} />;
  const home = session.profile.roles.includes("admin") ? "/admin" : session.profile.roles.includes("lecturer") || !session.profile.roles.includes("student") ? "/lecturer" : "/home";
  return (
    <main id="main" tabIndex={-1} className="inbox-page">
      <div className="inbox-sheet">
        <Link href={home} className="inbox-back"><ChevronLeft className="size-4" aria-hidden />Back</Link>
        <NotificationsView settings={<NotificationSettings owner={session.userId} />} />
      </div>
    </main>
  );
}
