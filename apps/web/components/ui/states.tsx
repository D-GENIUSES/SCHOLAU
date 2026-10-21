"use client";

import { RefreshCw, WifiOff } from "lucide-react";
import type * as React from "react";
import { useEffect, useState } from "react";
import { isApiError } from "@scholau/api";
import { errorMessage } from "@scholau/core";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { useOnline } from "@/lib/hooks";
import { ScreenSkeleton, type LoadingVariant } from "./screen-skeleton";

export function LoadingState({ label = "Loading…", className, lines = 3, variant = "list" }: { label?: string; className?: string; lines?: number; variant?: LoadingVariant }) {
  const online = useOnline();
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const timer = window.setTimeout(() => setSlow(true), 12_000);
    return () => window.clearTimeout(timer);
  }, []);
  return (
    <div className={cn("min-w-0 space-y-5", className)} data-loading-offline={!online} data-loading-variant={variant}>
      <div role="status" aria-live="polite" className={online && !slow ? "sr-only" : undefined}>
        {!online ? <div className="flex items-start gap-3 rounded-xl border border-line bg-surface-card p-4 text-sm text-ink-muted"><WifiOff className="mt-0.5 size-5 shrink-0" aria-hidden /><p>You’re offline. This screen will load when your connection returns. Previously loaded screens may still be available.</p></div> : slow ? <div className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-surface-card p-4 text-sm text-ink-muted"><p>This is taking longer than usual. Check your connection or try again.</p><Button variant="outline" size="sm" onClick={() => window.location.reload()}>Try again</Button></div> : <span className="sr-only">{label}</span>}
      </div>
      <div aria-hidden="true"><ScreenSkeleton variant={variant} lines={lines} /></div>
    </div>
  );
}

export function SkeletonState({ label = "Loading…" }: { label?: string }) {
  return <LoadingState label={label} lines={2} />;
}

export function EmptyState({
  title,
  description,
  action,
  icon,
  className,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-3 rounded-card border border-line bg-surface-card px-5 py-8 text-center", className)}>
      {icon ? <span className="text-brand-primary" aria-hidden>{icon}</span> : null}
      <h2 className="text-base font-semibold">{title}</h2>
      {description ? <div className="max-w-md text-sm leading-relaxed text-ink-muted">{description}</div> : null}
      {action ? <div className="mt-2 flex flex-wrap justify-center gap-2">{action}</div> : null}
    </div>
  );
}

/** Plain retry with request reference for support; never fabricates a result. */
export function ErrorState({
  error,
  onRetry,
  title = "We couldn't load this",
  className,
  action,
}: {
  error: unknown;
  onRetry?: () => void;
  title?: string;
  className?: string;
  action?: React.ReactNode;
}) {
  const apiErr = isApiError(error) ? error : null;
  const offline = apiErr?.code === "NETWORK";
  const message = apiErr ? errorMessage(apiErr) : "Something went wrong. Please try again.";
  return (
    <div role="alert" className={cn("flex flex-col items-center gap-3 rounded-card border border-line bg-surface-card px-5 py-8 text-center", className)}>
      <span className="inline-flex size-12 items-center justify-center rounded-pill bg-danger-bg text-danger" aria-hidden>
        {offline ? <WifiOff className="size-6" /> : <RefreshCw className="size-6" />}
      </span>
      <h2 className="text-base font-semibold">{offline ? "You're offline" : title}</h2>
      <p className="max-w-md text-sm leading-relaxed text-ink-muted">{message}</p>
      {apiErr ? <p className="text-sm text-ink-muted">Reference: {apiErr.reference}</p> : null}
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        {onRetry ? (
          <Button onClick={onRetry} variant="primary">
            <RefreshCw className="size-4" aria-hidden /> Try again
          </Button>
        ) : null}
        {action}
      </div>
    </div>
  );
}

/** Inline error for mutations: message, field errors are handled by forms. */
export function InlineError({ error, className }: { error: unknown; className?: string }) {
  if (!error) return null;
  const apiErr = isApiError(error) ? error : null;
  return (
    <p role="alert" className={cn("rounded-control border border-[#f3c4bf] bg-danger-bg p-3 text-sm font-medium text-danger", className)}>
      {apiErr ? errorMessage(apiErr) : "Something went wrong. Please try again."}
      {apiErr && !apiErr.retryable && apiErr.code !== "VALIDATION_FAILED" ? (
        <span className="block font-normal text-ink-muted">Reference: {apiErr.reference}</span>
      ) : null}
    </p>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) { return <LoadingState label={label} variant="question" />; }
