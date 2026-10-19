"use client";

import Link from "next/link";
import { useLinkStatus } from "next/link";
import { forwardRef, type ComponentProps } from "react";
import { cn } from "@/lib/utils";

function PendingWave() {
  const { pending } = useLinkStatus();
  return pending ? <span className="nav-pending" aria-hidden /> : null;
}

export const NavLink = forwardRef<HTMLAnchorElement, ComponentProps<typeof Link>>(function NavLink(
  { className, children, ...props },
  ref,
) {
  return (
    <Link ref={ref} className={cn("relative", className)} {...props}>
      {children}
      <PendingWave />
    </Link>
  );
});
