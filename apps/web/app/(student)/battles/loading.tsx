import { LoadingState } from "@/components/ui/states";
import { Skeleton } from "@/components/ui/misc";
export default function Loading() {
  return <div className="space-y-6"><div className="mb-6 space-y-2"><Skeleton className="h-8 w-64 max-w-full" /><Skeleton className="h-5 w-96 max-w-full" /></div><LoadingState variant="lobby" /></div>;
}
