import { CourseChallenges } from "@/components/challenges/course-challenges";

export default async function LecturerChallengesPage({ params }: { params: Promise<{ offeringId: string }> }) {
  const { offeringId } = await params;
  return <CourseChallenges offering={offeringId} workspace />;
}
