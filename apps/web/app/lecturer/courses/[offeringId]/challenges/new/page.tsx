import { ChallengeEditor } from "@/components/challenges/challenge-editor";
export default async function Page({ params }: { params: Promise<{ offeringId: string }> }) { const { offeringId } = await params; return <ChallengeEditor offering={offeringId} />; }
