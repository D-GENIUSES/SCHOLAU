import Image from "next/image";
import { cn } from "@/lib/utils";

/** Brand assets live in public/brand (sourced from assets/brand). */
export function LogoMark({ className, title }: { className?: string; title?: string }) {
  return (
    <Image
      src="/brand/scholau-logo-mark.svg"
      alt={title ?? ""}
      aria-hidden={title ? undefined : true}
      width={36}
      height={36}
      unoptimized
      priority
      className={cn("size-9", className)}
    />
  );
}

export function Logo({ className, compact, variant = "color" }: { className?: string; compact?: boolean; variant?: "color" | "white" }) {
  if (compact) {
    return (
      <span className={cn("inline-flex items-center", className)}>
        <LogoMark title="ScholAu" />
      </span>
    );
  }
  return (
    <Image
      src={variant === "white" ? "/brand/scholau-logo-white.svg" : "/brand/scholau-logo-full.svg"}
      alt="ScholAu"
      width={137}
      height={36}
      unoptimized
      priority
      className={cn("h-9 w-auto", className)}
    />
  );
}
