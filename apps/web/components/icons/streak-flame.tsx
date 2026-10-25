"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** Layered flame with a bright core and an unlit silhouette for idle streaks. */
export function StreakFlame({ active = false, className, size = 24 }: {
  active?: boolean;
  className?: string;
  size?: number;
}) {
  const uid = useId().replace(/:/g, "");
  const outer = `${uid}-outer`;
  const inner = `${uid}-inner`;
  const core = `${uid}-core`;
  const silhouette = "M12.9 1c1.2 4.8-3.8 6.2-2.4 10.1 1-1.1 1.5-2.4 1.3-3.8 3.1 1.9 4.5 4.3 4.1 6.6 1.6-1.3 2.2-3.4 1.7-5.3 3.2 3.2 4.4 6.4 2.9 9.6C19.1 21.4 16 23 12 23c-4.4 0-7.9-2.2-8.8-5.7-.8-3.1.6-6 3.3-8.7-.5 2.6-.2 4.2.9 5.2C6.6 8.7 12.1 6.9 12.9 1Z";

  return (
    <svg width={size} height={size}
      viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      style={active ? { filter: "drop-shadow(0 1px 3px #ff6b2445)" } : undefined}
      aria-hidden="true" focusable="false">
      <g transform="translate(3 0) scale(.75 1)">
      {active ? (
        <>
          <defs>
            <linearGradient id={outer} x1="12" y1="1" x2="12" y2="23" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffce42" /><stop offset="0.35" stopColor="#ff8a13" />
              <stop offset="0.7" stopColor="#f3450b" /><stop offset="1" stopColor="#cc250c" />
            </linearGradient>
            <linearGradient id={inner} x1="12" y1="7" x2="12" y2="23" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffe878" /><stop offset="0.48" stopColor="#ffc324" /><stop offset="1" stopColor="#ff8a0b" />
            </linearGradient>
            <radialGradient id={core} cx="0" cy="0" r="1" gradientTransform="translate(11.9 20) rotate(-90) scale(8 4.8)" gradientUnits="userSpaceOnUse">
              <stop stopColor="#ffffff" /><stop offset="0.4" stopColor="#fffbd5" /><stop offset="1" stopColor="#ffe66b" />
            </radialGradient>
          </defs>
          <path d={silhouette} fill={`url(#${outer})`} />
          <path d="M12.2 7.9c.9 3.8-3.4 5.3-2.1 8.1.7-.6 1.3-1.8 1.2-3.1 3 2 2.5 4.2 3.5 4.7.9-.5 1.6-1.6 1.7-3 1.6 2.8 1 5.1-.8 6.5-1 .8-2.3 1.2-3.7 1.2-2.9 0-5.2-1.7-5.3-4.4-.1-2.9 2.5-4.7 3.1-6.9.2 1.1.3 2 .1 2.8 1.4-1.4 2.1-3.7 2.3-5.9Z" fill={`url(#${inner})`} />
          <path d="M12.3 14.2c.4 2.8-2.3 3.4-1.8 5.4.8-.3 1.2-1.1 1.3-2 1.8 1.2 2.9 2.3 2.4 3.5-.4 1-1.3 1.5-2.4 1.5-1.8 0-3.1-1-3.1-2.5 0-2.3 2.8-3.7 3.6-5.9Z" fill={`url(#${core})`} />
        </>
      ) : (
        <>
          <path d={silhouette} fill="currentColor" opacity="0.6" />
          <path d="M12.3 13c.7 3.1-2.4 4.5-2.1 6.6.2 1.4 1.2 2.3 2.5 2.3 1.7 0 2.9-1.3 2.5-3.1-.8.4-1.5.1-1.6-.9-.1-1.6-.6-3.5-1.3-4.9Z" fill="currentColor" opacity="0.35" />
        </>
      )}
      </g>
    </svg>
  );
}
