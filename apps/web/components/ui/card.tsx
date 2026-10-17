import * as React from "react";
import { cn } from "@/lib/utils";

export function Card({ className, tint, ...props }: React.HTMLAttributes<HTMLDivElement> & { tint?: boolean }) {
  return (
    <div
      className={cn(
        "rounded-card border border-line shadow-card",
        tint ? "bg-surface-tint border-[#cfe3fb]" : "bg-surface-card",
        className,
      )}
      {...props}
    />
  );
}

export function CardHeader({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-col gap-1 p-4 pb-2 sm:p-5 sm:pb-2", className)} {...props} />;
}

export function CardTitle({
  className,
  as: Tag = "h2",
  ...props
}: React.HTMLAttributes<HTMLHeadingElement> & { as?: "h2" | "h3" | "h4" }) {
  return <Tag className={cn("text-base font-semibold tracking-[-0.015em] text-ink", className)} {...props} />;
}

export function CardDescription({ className, ...props }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={cn("text-sm text-ink-muted", className)} {...props} />;
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("p-4 pt-2 sm:p-5 sm:pt-2", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex flex-wrap items-center gap-2 p-4 pt-0 sm:p-5 sm:pt-0", className)} {...props} />;
}
