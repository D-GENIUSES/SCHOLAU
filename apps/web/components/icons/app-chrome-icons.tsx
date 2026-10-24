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

export function AppStarIcon({ className, size, ...props }: IconProps) {
  return (
    <svg {...base({ className, size, ...props })}>
      <path
        d="M12 2.8 14.4 8.6l6.2.5-4.7 3.9 1.5 6.1L12 16.4l-5.4 3.7 1.5-6.1-4.7-3.9 6.2-.5L12 2.8Z"
        fill="currentColor"
      />
      <path
        d="M12 5.2 13.6 9.2l4.2.35-3.2 2.65.95 3.95L12 14.1l-3.55 2.45.95-3.95-3.2-2.65 4.2-.35L12 5.2Z"
        fill="currentColor"
        opacity="0.35"
      />
    </svg>
  );
}

export function AppBookIcon({ className, size, ...props }: IconProps) {
  return (
    <svg {...base({ className, size, ...props })}>
      <path
        d="M5 5.5c0-.83.67-1.5 1.5-1.5.42 0 .81.17 1.09.45L12 8.2l4.41-3.75A1.5 1.5 0 0 1 17.5 4c.83 0 1.5.67 1.5 1.5v13c0 .83-.67 1.5-1.5 1.5-.42 0-.81-.17-1.09-.45L12 15.3l-4.41 3.75A1.5 1.5 0 0 1 6.5 19.5 1.5 1.5 0 0 1 5 18V5.5Z"
        fill="currentColor"
      />
      <path d="M12 8.2v11.1" stroke="currentColor" strokeWidth="1.25" strokeOpacity="0.35" />
    </svg>
  );
}

export function AppSwordsIcon({ className, size, ...props }: IconProps) {
  return (
    <svg {...base({ className, size, ...props })}>
      <path
        d="m8.2 16.8 1.6-7.2 2.9 1.2-1.6 7.2-2.9-1.2ZM15.8 16.8l-1.6-7.2-2.9 1.2 1.6 7.2 2.9-1.2Z"
        fill="currentColor"
      />
      <circle cx="12" cy="6.5" r="2" fill="currentColor" opacity="0.85" />
    </svg>
  );
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
