import { CourseChallenges } from "@/components/challenges/course-challenges";
export default async function Page({ params }: { params: Promise<{ offeringId: string }> }) { const { offeringId } = await params; return <CourseChallenges offering={offeringId} />; }
