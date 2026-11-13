import { LoadingState } from "@/components/ui/states";

export default function Loading() {
  return (
    <div className="lesson-study mx-auto max-w-reading">
      <div className="lesson-study-header mb-6 min-h-[7.5rem]" aria-hidden />
      <LoadingState variant="lesson" label="Loading lesson…" lines={5} />
    </div>
  );
}
