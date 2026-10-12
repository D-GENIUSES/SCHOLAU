"use client";

import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import * as React from "react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  hideClose,
  ...props
}: React.ComponentProps<typeof DialogPrimitive.Content> & { hideClose?: boolean }) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-[#11243c]/45" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-50 flex max-h-[90dvh] w-[calc(100vw-32px)] max-w-lg -translate-x-1/2 -translate-y-1/2 flex-col gap-4 overflow-y-auto rounded-card border border-line bg-surface-card p-6 shadow-raised",
          className,
        )}
        {...props}
      >
        {children}
        {hideClose ? null : (
          <DialogPrimitive.Close
            className="absolute right-3 top-3 inline-flex size-11 items-center justify-center rounded-control text-ink-muted hover:bg-surface-tint hover:text-ink"
            aria-label="Close"
          >
            <X className="size-5" aria-hidden />
          </DialogPrimitive.Close>
        )}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}

export function DialogTitle({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Title>) {
  return <DialogPrimitive.Title className={cn("pr-10 text-xl font-bold text-ink", className)} {...props} />;
}

export function DialogDescription({ className, ...props }: React.ComponentProps<typeof DialogPrimitive.Description>) {
  return <DialogPrimitive.Description className={cn("text-ink-muted", className)} {...props} />;
}

export function DialogFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("mt-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", className)} {...props} />;
}

/** Confirmation dialog with explicit consequences text. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  children,
  confirmLabel,
  cancelLabel = "Cancel",
  onConfirm,
  destructive,
  loading,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  onConfirm: () => void;
  destructive?: boolean;
  loading?: boolean;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogTitle>{title}</DialogTitle>
        {description ? <DialogDescription>{description}</DialogDescription> : null}
        {children}
        <DialogFooter>
          <DialogClose asChild>
            <button
              type="button"
              className="inline-flex min-h-12 items-center justify-center rounded-control border border-line bg-surface-card px-5 font-semibold text-ink hover:bg-surface-page"
            >
              {cancelLabel}
            </button>
          </DialogClose>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            aria-busy={loading || undefined}
            className={cn(
              "inline-flex min-h-12 items-center justify-center rounded-control px-5 font-semibold text-ink-inverse disabled:opacity-55",
              destructive ? "bg-danger hover:bg-[#9a1d14]" : "bg-brand-primary hover:bg-brand-primary-hover",
            )}
          >
            {confirmLabel}
          </button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
