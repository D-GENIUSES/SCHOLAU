"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export default function LecturerError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const [reference] = useState(() => error.digest ?? "SA-LECTURER-UI");

  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg space-y-4 py-6 text-center">
      <div role="alert" className="space-y-2">
        <h1 className="text-2xl font-bold">This page couldn&apos;t load</h1>
        <p className="text-sm text-ink-muted">
          Your lecturer workspace is still available. Try again, or return to your courses.
        </p>
        <p className="text-xs text-ink-muted">Reference: {reference}</p>
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
