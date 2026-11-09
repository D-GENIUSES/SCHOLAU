import { Suspense } from "react";
import { isApiError, type CourseOverview, type LecturerQuizList } from "@scholau/api";
import { getSessionApi } from "@/lib/session";
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
  let quizListError: string | undefined;

  try {
    initialOverview = await api.getCourseOverview(offeringId);
  } catch {
    initialOverview = undefined;
  }

  try {
    initialQuizList = await api.listCourseQuizzes(offeringId, 0);
  } catch (error) {
    quizListError = isApiError(error) ? `${error.code}:${error.message}` : String(error);
  }

  return (
    <Suspense fallback={<LoadingState variant="assessment" label="Loading assessments…" />}>
      <AssessmentsRoute
        initialOverview={initialOverview}
        initialQuizList={initialQuizList}
        quizListError={quizListError}
      />
    </Suspense>
  );
}
