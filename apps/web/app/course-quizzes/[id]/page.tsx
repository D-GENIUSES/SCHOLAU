import { isApiError, type LecturerQuizDetail } from "@scholau/api";
import { getSessionApi } from "@/lib/session";
import { QuizRoomLoader } from "./quiz-room-loader";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  let initialDetail: LecturerQuizDetail | undefined;
  try {
    initialDetail = await (await getSessionApi()).getCourseQuiz(id);
  } catch (error) {
    if (
      !isApiError(error, "FORBIDDEN")
      && !isApiError(error, "NOT_ENROLLED")
      && !isApiError(error, "NOT_FOUND")
    ) {
      throw error;
    }
  }
  return <QuizRoomLoader id={id} initialDetail={initialDetail} />;
}
