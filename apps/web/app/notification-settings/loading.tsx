import { LoadingState } from "@/components/ui/states";
import { ScreenSkeleton } from "@/components/ui/screen-skeleton";
import { Skeleton } from "@/components/ui/misc";
export default function Loading() {
 return <main id="main" className="mx-auto grid max-w-2xl gap-6 px-4 py-8"><Skeleton className="h-6 w-40" /><Skeleton className="h-9 w-72 max-w-full" /><LoadingState variant="settings" /><div aria-hidden="true"><ScreenSkeleton variant="notifications" /></div></main>;
}
