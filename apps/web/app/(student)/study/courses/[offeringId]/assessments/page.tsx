import { Suspense } from "react";
import { isApiError, type CourseOverview } from "@scholau/api";
import type { LecturerQuizList } from "@scholau/api";
import { getSessionApi } from "@/lib/session";
import { agentDebugLogServer } from "@/lib/agent-debug-log-server";
import { LoadingState } from "@/components/ui/states";
import { AssessmentsRoute } from "./assessments-route";

type PageProps = {
  params: Promise<{ offeringId: string }>;
};

export default async function CourseAssessmentsPage({ params }: PageProps) {
  const { offeringId } = await params;
  const api = await getSessionApi();
  let initialOverview: CourseOverview | undefined;
  let initialQuizList: LecturerQuizList | undefined;
  let overviewError: string | undefined;
  let quizListError: string | undefined;

  try {
    initialOverview = await api.getCourseOverview(offeringId);
  } catch (error) {
    overviewError = isApiError(error) ? `${error.code}:${error.message}` : String(error);
  }

  try {
    initialQuizList = await api.listCourseQuizzes(offeringId, 0);
  } catch (error) {
    quizListError = isApiError(error) ? `${error.code}:${error.message}` : String(error);
  }

  await agentDebugLogServer({
    location: "assessments/page.tsx",
    message: "assessments server prefetch",
    runId: "post-fix",
    hypothesisId: "B",
    data: {
      offeringId,
      hasOverview: Boolean(initialOverview),
      overviewError,
      quizCount: initialQuizList?.items?.length ?? 0,
      quizStates: initialQuizList?.items?.map((q) => q.state) ?? [],
      quizListError,
    },
  });

  return (
    <Suspense fallback={<LoadingState variant="assessment" label="Loading assessments…" />}>
      <AssessmentsRoute initialOverview={initialOverview} initialQuizList={initialQuizList} />
    </Suspense>
  );
}
