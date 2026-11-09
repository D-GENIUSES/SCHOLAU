"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function LecturerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[scholau]", error.digest ?? "lecturer-ui", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-5 py-10 text-center">
      <div role="alert" className="flex flex-col items-center gap-3">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-danger-bg text-danger" aria-hidden>
          <RefreshCw className="size-7" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">This page couldn&apos;t load</h1>
        <p className="text-sm text-ink-muted">
          Your lecturer workspace is still available. Try again, or return to your courses.
        </p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw className="size-4" aria-hidden /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/lecturer">My courses</Link>
        </Button>
      </div>
    </div>
  );
}
