"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** ScholAu streak flame — warm gradient when active, flat grey when idle. */
export function StreakFlame({
  active = false,
  className,
  size = 20,
}: {
  active?: boolean;
  className?: string;
  size?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const outerGrad = `${uid}-outer`;
  const innerGrad = `${uid}-inner`;

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      aria-hidden
    >
      {active ? (
        <>
          <defs>
            <linearGradient id={outerGrad} x1="12" y1="22" x2="12" y2="1.5" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffb347" />
              <stop offset="0.35" stopColor="#f07828" />
              <stop offset="0.72" stopColor="#e85a18" />
              <stop offset="1" stopColor="#c93a0a" />
            </linearGradient>
            <linearGradient id={innerGrad} x1="12" y1="19" x2="12" y2="8" gradientUnits="userSpaceOnUse">
              <stop stopColor="#fff4d6" />
              <stop offset="0.45" stopColor="#ffd98a" />
              <stop offset="1" stopColor="#ffb84d" />
            </linearGradient>
          </defs>
          <path
            d="M12 22c0 0-7.5-5.2-7.5-11.2C4.5 8.2 6.8 5.2 9.4 3.6 9.8 6.4 11.2 7.4 12 7.4S14.2 6.4 14.6 3.6C17.2 5.2 19.5 8.2 19.5 10.8 19.5 16.8 12 22 12 22Z"
            fill={`url(#${outerGrad})`}
          />
          <path
            d="M12 19.2c0 0-4.2-3.4-4.2-7.2 0-2.4 1.8-4.2 4.2-4.2s4.2 1.8 4.2 4.2c0 3.8-4.2 7.2-4.2 7.2Z"
            fill={`url(#${innerGrad})`}
          />
          <path
            d="M10.2 14.8c.6-1.8 1.6-2.6 1.8-3.8.3 1.1 1.1 2 1.1 3.4 0 1.6-1.3 2.9-2.9 2.9-.4 0-.8-.1-1.1-.3.8-.6 1.1-1.4 1.1-2.2Z"
            fill="#fff8eb"
            opacity="0.85"
          />
        </>
      ) : (
        <path
          d="M12 21.2c0 0-6.8-4.7-6.8-10.2C5.2 8.8 7.2 6.2 9.4 4.8 9.7 7.1 10.9 8 12 8s2.3-.9 2.6-3.2c2.2 1.4 4.2 4 4.2 6.2 0 5.5-6.8 10.2-6.8 10.2ZM12 17.8c0 0-3.6-2.9-3.6-6.2 0-2 1.5-3.6 3.6-3.6s3.6 1.6 3.6 3.6c0 3.3-3.6 6.2-3.6 6.2Z"
          fill="currentColor"
          opacity="0.72"
        />
      )}
    </svg>
  );
}
