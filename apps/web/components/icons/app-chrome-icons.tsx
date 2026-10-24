import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

type IconProps = SVGProps<SVGSVGElement> & { className?: string; size?: number };

function base({ className, size = 24, ...props }: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className: cn("shrink-0", className),
    "aria-hidden": true as const,
    ...props,
  };
}

export function AppBellIcon({ className, size, ...props }: IconProps) {
  return (
    <svg {...base({ className, size, ...props })}>
      <path
        d="M12 3.5c-2.65 0-4.8 2.15-4.8 4.8v3.2l-1.4 2.3c-.35.58.08 1.3.75 1.3h11.3c.67 0 1.1-.72.75-1.3l-1.4-2.3V8.3c0-2.65-2.15-4.8-4.8-4.8Z"
        fill="currentColor"
      />
      <path
        d="M10.2 18.2a1.8 1.8 0 0 0 3.6 0"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
    </svg>
  );
}

export function AppSearchIcon({ className, size, ...props }: IconProps) {
  return (
    <svg {...base({ className, size, ...props })}>
      <path
        d="M10.5 4.5a6 6 0 1 1 0 12 6 6 0 0 1 0-12Z"
        fill="currentColor"
        opacity="0.22"
      />
      <path
        d="M10.5 5.75a4.75 4.75 0 1 1 0 9.5 4.75 4.75 0 0 1 0-9.5Z"
        fill="currentColor"
      />
      <path
        d="M14.6 14.6 19.2 19.2"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}
