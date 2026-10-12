import { RefreshCw } from "lucide-react";
import Link from "next/link";
import { COPY } from "@scholau/core";
import { Logo } from "./logo";

export function ServiceUnavailable({ reference, message }: { reference: string; message?: string }) {
  return (
    <main id="main" className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center gap-4 px-4 text-center">
      <Logo />
      <h1 className="text-2xl font-bold">We can&apos;t reach ScholAu right now</h1>
      <p className="text-ink-muted">{message ?? COPY.empty.serviceUnavailable}</p>
      <p className="text-sm text-ink-muted">Reference: {reference}</p>
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
