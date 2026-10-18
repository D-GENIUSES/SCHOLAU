import { notFound } from "next/navigation";
import { AnswerOptionsPreview } from "@/components/battle/answer-options-preview";

export default function BattleAnswerPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <AnswerOptionsPreview />;
}
