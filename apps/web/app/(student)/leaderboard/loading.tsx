import { LoadingState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/misc";
export default function Loading() {
  return <div className="mx-auto w-full max-w-3xl space-y-4"><div className="mb-6 space-y-2"><Skeleton className="h-8 w-64 max-w-full" /><Skeleton className="h-5 w-96 max-w-full" /></div><div className="flex gap-2"><Skeleton className="h-11 w-24 rounded-full" /><Skeleton className="h-11 w-24 rounded-full" /></div><LoadingState variant="leaderboard" /></div>;
}
