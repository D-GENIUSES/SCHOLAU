import { notFound } from "next/navigation";
import { BattleFlowPreview } from "@/components/battle/flow-preview";

export default function BattleFlowPreviewPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <BattleFlowPreview />;
}
