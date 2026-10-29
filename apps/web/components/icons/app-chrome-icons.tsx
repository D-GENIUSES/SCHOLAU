import type { SVGProps } from "react";
import { Swords } from "lucide-react";
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

export function AppStarIcon({ className, size, ...props }: IconProps) {
  return (
    <svg {...base({ className, size, ...props })}>
      <path
        d="M12 3.8 14.2 9.5l6 0.5-4.6 3.8 1.5 5.9L12 16.8 7.9 19.7l1.5-5.9L4.8 10l6-.5L12 3.8Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function AppBookIcon({ className, size, ...props }: IconProps) {
  return (
    <svg {...base({ className, size, ...props })}>
      <path
        d="M12 4.2c-4.35 0-7.75 1.25-7.75 2.85V18.4c0 .75.62 1.35 1.38 1.35.42 0 .82-.2 1.08-.52L12 16.5l5.29 3.73c.26.32.66.52 1.08.52.76 0 1.38-.6 1.38-1.35V7.05c0-1.6-3.4-2.85-7.75-2.85Z"
        fill="currentColor"
      />
    </svg>
  );
}

export function AppSwordsIcon({ className, size, ...props }: IconProps) {
  return <Swords {...props} size={size ?? 24} strokeWidth={1.9} className={cn("shrink-0", className)} aria-hidden />;
}
