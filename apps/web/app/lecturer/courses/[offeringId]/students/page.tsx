import Link from "next/link";
import { CourseRoster } from "@/components/challenges/course-challenges";
export default async function Page({ params }: { params: Promise<{ offeringId: string }> }) { const { offeringId } = await params; return <><Link className="inline-flex min-h-11 items-center underline" href={`/courses/${offeringId}/challenges`}>Course challenges</Link><CourseRoster offering={offeringId} /></>; }
