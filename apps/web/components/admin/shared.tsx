"use client";

import { Archive, Check, CheckCircle2, Copy, PencilLine } from "lucide-react";
import Link from "next/link";
import { type ReactNode, useId, useState } from "react";
import { isApiError } from "@scholau/api";
import { type ContentStatus, fieldErrorMessage, reasonSchema } from "@scholau/core";
import { Button } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { NativeSelect, Textarea } from "@/components/ui/input";
import { Badge } from "@/components/ui/misc";
import { ErrorState, InlineError } from "@/components/ui/states";

/** Compact page title for admin routes (sidebar already signals admin context). */
export function AdminPageHeader({
  title,
  description,
  actions,
}: {
  title: React.ReactNode;
  description?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-[1.35rem]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted sm:text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}

export const CONTENT_STATUSES: readonly { value: ContentStatus; label: string }[] = [
  { value: "draft", label: "Draft" },
  { value: "published", label: "Published" },
  { value: "retired", label: "Retired" },
];

export function StatusBadge({ status }: { status: ContentStatus }) {
  if (status === "published")
    return (
      <Badge tone="success">
        <CheckCircle2 className="size-3.5" aria-hidden /> Published
      </Badge>
    );
  if (status === "draft")
    return (
      <Badge tone="warning">
        <PencilLine className="size-3.5" aria-hidden /> Draft
      </Badge>
    );
  return (
    <Badge tone="neutral">
      <Archive className="size-3.5" aria-hidden /> Retired
    </Badge>
  );
}

export function humanize(value: string | null | undefined): string {
  if (!value) return "—";
  const s = value.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function shortId(id: string | null | undefined): string {
  return id ? id.slice(0, 8) : "—";
}

/** Load-error state; FORBIDDEN means the server refused the admin role. */
export function AdminErrorState({ error, onRetry }: { error: unknown; onRetry: () => void }) {
  if (isApiError(error, "FORBIDDEN")) {
    return (
      <ErrorState
        error={error}
        title="Administrator access required"
        action={
          <Button asChild variant="outline">
            <Link href="/home">Back to app</Link>
          </Button>
        }
      />
    );
  }
  return <ErrorState error={error} onRetry={onRetry} />;
}

function describeFieldError(value: unknown): string {
  if (typeof value === "string") return fieldErrorMessage(value);
  if (Array.isArray(value)) return value.map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join("; ");
  if (value && typeof value === "object") {
    const o = value as Record<string, unknown>;
    const parts: string[] = [];
    if (typeof o.message === "string") parts.push(fieldErrorMessage(o.message));
    for (const [k, v] of Object.entries(o)) {
      if (k === "message") continue;
      parts.push(`${humanize(k)}: ${Array.isArray(v) ? v.join(", ") : String(v)}`);
    }
    return parts.join(" — ");
  }
  return fieldErrorMessage(value);
}

/** Server error for a mutation, including `field_errors` (e.g. publish validation). */
export function MutationError({ error }: { error: unknown }) {
  if (!error) return null;
  const fieldErrors = isApiError(error) ? error.field_errors : undefined;
  const entries = fieldErrors ? Object.entries(fieldErrors) : [];
  return (
    <div className="flex flex-col gap-2">
      <InlineError error={error} />
      {entries.length > 0 ? (
        <ul className="list-disc space-y-1 pl-6 text-sm text-danger" aria-label="Details">
          {entries.map(([field, value]) => (
            <li key={field}>
              <span className="font-semibold">{humanize(field)}:</span> <span className="break-words">{describeFieldError(value)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export function CopyableId({ id, short }: { id: string | null | undefined; short?: boolean }) {
  const [copied, setCopied] = useState(false);
  if (!id) return <span className="text-ink-muted">—</span>;
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };
  return (
    <span className="inline-flex max-w-full items-center gap-1">
      <code className="break-all font-mono text-sm" title={id}>
        {short ? shortId(id) : id}
      </code>
      <button
        type="button"
        onClick={copy}
        className="inline-flex size-11 shrink-0 items-center justify-center rounded-control text-ink-muted hover:bg-surface-tint hover:text-ink"
        aria-label={copied ? "Copied" : `Copy ID ${id}`}
      >
        {copied ? <Check className="size-4 text-success" aria-hidden /> : <Copy className="size-4" aria-hidden />}
      </button>
      <span role="status" className="sr-only">
        {copied ? "ID copied" : ""}
      </span>
    </span>
  );
}

export function FilterSelect<V extends string>({
  label,
  value,
  onChange,
  options,
  className,
}: {
  label: string;
  value: V;
  onChange: (v: V) => void;
  options: readonly { value: V; label: string }[];
  className?: string;
}) {
  const id = useId();
  return (
    <Field id={id} label={label} className={className ?? "w-full sm:w-60"}>
      <NativeSelect value={value} onChange={(e) => onChange(e.target.value as V)}>
        {options.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </NativeSelect>
    </Field>
  );
}

/**
 * Confirmation that requires a written reason. Mount it only while open so the reason resets for
 * each new intent.
 */
export function ReasonDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  onConfirm,
  loading,
  error,
  destructive = true,
  reasonLabel = "Reason",
  reasonHint = "Recorded in the audit log.",
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  children?: ReactNode;
  confirmLabel: string;
  onConfirm: (reason: string) => void;
  loading?: boolean;
  error?: unknown;
  destructive?: boolean;
  reasonLabel?: string;
  reasonHint?: string;
}) {
  const id = useId();
  const [reason, setReason] = useState("");
  const [clientError, setClientError] = useState<string | undefined>();
  const submit = () => {
    const parsed = reasonSchema.safeParse(reason);
    if (!parsed.success) {
      setClientError(parsed.error.issues[0]?.message ?? "Give a reason.");
      return;
    }
    setClientError(undefined);
    onConfirm(parsed.data);
  };
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={loading ? "Working…" : confirmLabel}
      onConfirm={submit}
      destructive={destructive}
      loading={loading}
    >
      {children}
      <Field id={id} label={reasonLabel} hint={reasonHint} error={clientError}>
        <Textarea value={reason} onChange={(e) => setReason(e.target.value)} maxLength={1000} required />
      </Field>
      <MutationError error={error} />
    </ConfirmDialog>
  );
}
