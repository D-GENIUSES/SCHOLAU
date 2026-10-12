"use client";

import { Inbox, Loader2, RefreshCw, WifiOff } from "lucide-react";
import type * as React from "react";
import { isApiError } from "@scholau/api";
import { errorMessage } from "@scholau/core";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Skeleton } from "./misc";

export function LoadingState({ label = "Loading…", className, lines = 3 }: { label?: string; className?: string; lines?: number }) {
  return (
    <div className={cn("flex flex-col gap-3", className)} role="status" aria-live="polite">
      <span className="sr-only">{label}</span>
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} className={cn("h-20 w-full", i === 0 && "h-10 w-2/3")} />
      ))}
    </div>
  );
}

export function Spinner({ label = "Loading…" }: { label?: string }) {
  return (
    <span role="status" className="inline-flex items-center gap-2 text-ink-muted">
      <Loader2 className="size-5 animate-spin" aria-hidden />
      <span>{label}</span>
    </span>
  );
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
    <div className={cn("flex flex-col items-center gap-3 rounded-card border border-dashed border-line bg-surface-card px-6 py-10 text-center", className)}>
      <span className="inline-flex size-12 items-center justify-center rounded-pill bg-surface-tint text-brand-primary" aria-hidden>
        {icon ?? <Inbox className="size-6" />}
      </span>
      <h2 className="text-lg font-bold">{title}</h2>
      {description ? <div className="max-w-md text-ink-muted">{description}</div> : null}
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
    <div role="alert" className={cn("flex flex-col items-center gap-3 rounded-card border border-line bg-surface-card px-6 py-10 text-center", className)}>
      <span className="inline-flex size-12 items-center justify-center rounded-pill bg-danger-bg text-danger" aria-hidden>
        {offline ? <WifiOff className="size-6" /> : <RefreshCw className="size-6" />}
      </span>
      <h2 className="text-lg font-bold">{offline ? "You're offline" : title}</h2>
      <p className="max-w-md text-ink-muted">{message}</p>
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
