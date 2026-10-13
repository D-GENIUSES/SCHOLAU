import { Suspense } from "react";
import { GuestExperience } from "@/components/guest/guest-experience";
import { LoadingState } from "@/components/ui/states";
export default function EntryPage() {
  return <Suspense fallback={<LoadingState label="Opening ScholAu…" />}><GuestExperience /></Suspense>;
}
