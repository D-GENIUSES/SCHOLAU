import { LoadingState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/misc";

export default function Loading() {
  return (
    <main id="main" className="inbox-page">
      <div className="inbox-sheet">
        <Skeleton className="h-4 w-16" />
        <div className="space-y-2">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-28" />
        </div>
        <LoadingState variant="settings" label="Loading notifications…" />
        <div aria-hidden="true"><LoadingState variant="notifications" label="Loading notifications…" /></div>
      </div>
    </main>
  );
}
