import { AdminPageHeader } from "@/components/admin/shared";
import { Announcements } from "@/components/notifications/announcements";

export default function AdminAnnouncementsPage() {
  return (
    <>
      <AdminPageHeader title="Announcements" description="Targeted messages to students, lecturers, or course offerings." />
      <Announcements admin />
    </>
  );
}
