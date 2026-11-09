import { RefreshCw, WifiOff } from "lucide-react";
import Link from "next/link";
import { COPY } from "@scholau/core";
import { Logo } from "./logo";

export function ServiceUnavailable({ reference, message }: { reference?: string; message?: string }) {
  if (reference) {
    // Keep for support logs; never render in the UI.
    console.warn("[scholau] service unavailable", reference);
  }
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-5 px-4 text-center">
      <Logo />
      <span className="inline-flex size-14 items-center justify-center rounded-full border border-line bg-surface-card text-ink-muted" aria-hidden>
        <WifiOff className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-bold tracking-tight">We can&apos;t reach ScholAu right now</h1>
        <p className="text-ink-muted">{message ?? COPY.empty.serviceUnavailable}</p>
      </div>
      <div className="flex flex-wrap justify-center gap-2">
        <a
          href=""
          className="inline-flex min-h-12 items-center gap-2 rounded-control bg-brand-primary px-5 font-semibold text-ink-inverse hover:bg-brand-primary-hover"
        >
          <RefreshCw className="size-4" aria-hidden /> Try again
        </a>
        <Link href="/privacy" className="inline-flex min-h-12 items-center rounded-control border border-line px-5 font-semibold">
          Contact &amp; privacy
        </Link>
      </div>
    </main>
  );
}
