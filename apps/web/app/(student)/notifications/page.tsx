import { redirect } from "next/navigation";

/** The bell and old inbox links share the same inbox and device activation screen. */
export default function NotificationsPage() {
  redirect("/notification-settings");
}
