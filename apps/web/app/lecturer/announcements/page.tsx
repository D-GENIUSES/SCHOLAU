import { LecturerAnnouncements } from "@/components/lecturer/lecturer-announcements";

export default async function LecturerAnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<{ course?: string | string[] }>;
}) {
  const { course } = await searchParams;
  const initialCourse = typeof course === "string" ? course : undefined;
  return <LecturerAnnouncements key={initialCourse ?? "history"} initialCourse={initialCourse} />;
}
