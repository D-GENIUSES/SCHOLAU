"use client";

import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { Logo } from "@/components/logo";
import { Button } from "@/components/ui/button";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[scholau]", error.digest ?? "client-error", error);
  }, [error]);

  return (
    <main id="main" tabIndex={-1} className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-5 px-4 text-center">
      <Logo />
      <div role="alert" className="flex flex-col items-center gap-3">
        <span className="inline-flex size-14 items-center justify-center rounded-full bg-danger-bg text-danger" aria-hidden>
          <RefreshCw className="size-7" />
        </span>
        <h1 className="text-2xl font-bold tracking-tight">Something went wrong</h1>
        <p className="text-ink-muted">This page hit an unexpected problem. Your saved progress is not affected. Please try again.</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <Button onClick={reset}>
          <RefreshCw className="size-4" aria-hidden /> Try again
        </Button>
        <Button asChild variant="outline">
          <Link href="/home">Go to Home</Link>
        </Button>
      </div>
    </main>
  );
}
