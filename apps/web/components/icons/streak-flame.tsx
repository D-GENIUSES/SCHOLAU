"use client";

import { useId } from "react";
import { cn } from "@/lib/utils";

/** A layered, asymmetrical flame that remains legible at header-icon size. */
export function StreakFlame({ active = false, className, size = 24, tone = "warm" }: {
  active?: boolean;
  className?: string;
  size?: number;
  tone?: "warm" | "blue";
}) {
  const uid = useId().replace(/:/g, "");
  const outer = `${uid}-outer`;
  const middle = `${uid}-middle`;
  const core = `${uid}-core`;
  const shape = "M12.5 1.2c.6 3.4-2.5 5.3-2.1 8.3-1.2-1.2-1.7-2.7-1.4-4.5C5.3 8 3 11.3 3 15.1 3 20 6.8 23 12 23s9-3.2 9-8c0-3.2-1.5-5.4-4.4-7.9.7 2.9-.3 4.6-1.5 5.4.5-4.1-1-7.6-2.6-11.3Z";

  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      style={active ? { filter: tone === "blue" ? "drop-shadow(0 4px 12px #0866e855)" : "drop-shadow(0 1px 3px #ff6b2450)" } : undefined}
      aria-hidden="true" focusable="false">
      {active ? <>
        <defs>
          <linearGradient id={outer} x1="12" y1="1" x2="12" y2="23" gradientUnits="userSpaceOnUse">
            <stop stopColor={tone === "blue" ? "#c7f2ff" : "#ffcc3d"} /><stop offset=".38" stopColor={tone === "blue" ? "#58c1ff" : "#ff8c19"} /><stop offset=".75" stopColor={tone === "blue" ? "#0866e8" : "#f44b12"} /><stop offset="1" stopColor={tone === "blue" ? "#1749af" : "#c92b12"} />
          </linearGradient>
          <linearGradient id={middle} x1="12" y1="8" x2="12" y2="22" gradientUnits="userSpaceOnUse">
            <stop stopColor={tone === "blue" ? "#f7feff" : "#fff38a"} /><stop offset=".55" stopColor={tone === "blue" ? "#9ce5ff" : "#ffc32f"} /><stop offset="1" stopColor={tone === "blue" ? "#38a3ff" : "#ff8514"} />
          </linearGradient>
          <radialGradient id={core} cx="0" cy="0" r="1" gradientTransform="translate(12 18) rotate(-90) scale(7 4)" gradientUnits="userSpaceOnUse">
            <stop stopColor={tone === "blue" ? "#ffffff" : "#fffef0"} /><stop offset=".5" stopColor={tone === "blue" ? "#e4faff" : "#fff5a4"} /><stop offset="1" stopColor={tone === "blue" ? "#a8e8ff" : "#ffcd40"} />
          </radialGradient>
        </defs>
        <path d={shape} fill={`url(#${outer})`} />
        <path d="M12.8 8.2c.4 2.9-2.4 4.2-1.7 6.5-.9-.5-1.6-1.5-1.7-2.7-1.8 2.1-3 4.1-2.3 6.3.7 2.3 2.6 3.7 5.1 3.7 3.1 0 5.4-2.2 5.4-5.2 0-1.8-.7-3.3-2.4-5.2.1 2.2-.7 3.2-1.5 3.6.4-2-.4-4.4-1.9-7.2Z" fill={`url(#${middle})`} />
        <path d="M12.5 13.4c.2 2.1-1.6 3.2-1.2 4.6-.7-.5-.9-1.3-.8-2.1-1.2 1.5-2 3.2-1.2 4.6.5.9 1.4 1.4 2.7 1.4 1.9 0 3.3-1.4 3.3-3.2 0-1.4-.7-2.5-1.9-3.8.1 1.2-.3 1.9-.8 2.2.1-1.2-.3-2.4-.7-3.5Z" fill={`url(#${core})`} />
      </> : <>
        <path d={shape} fill="currentColor" opacity=".7" />
        <path d="M12.5 13.4c.2 2.1-1.6 3.2-1.2 4.6-.7-.5-.9-1.3-.8-2.1-1.2 1.5-2 3.2-1.2 4.6.5.9 1.4 1.4 2.7 1.4 1.9 0 3.3-1.4 3.3-3.2 0-1.4-.7-2-1.9-3.8Z" fill="currentColor" opacity=".28" />
      </>}
    </svg>
  );
}
