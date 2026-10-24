import type { SVGProps } from "react";
import { cn } from "@/lib/utils";

type NavIconProps = SVGProps<SVGSVGElement> & { className?: string };

function iconProps(className: string | undefined, props: NavIconProps) {
  return {
    width: 24,
    height: 24,
    viewBox: "0 0 24 24",
    fill: "none",
    xmlns: "http://www.w3.org/2000/svg",
    className: cn("shrink-0", className),
    "aria-hidden": true as const,
    ...props,
  };
}

export function NavHomeIcon({ className, ...props }: NavIconProps) {
  return (
    <svg {...iconProps(className, props)}>
      <path
        d="M4 10.2 12 4l8 6.2V19a1.5 1.5 0 0 1-1.5 1.5H15v-5.5H9V20.5H5.5A1.5 1.5 0 0 1 4 19v-8.8Z"
        fill="currentColor"
        opacity="0.18"
      />
      <path
        d="M5 10.8 12 5.2l7 5.6V19a.5.5 0 0 1-.5.5H15v-5H9v5.5H5.5a.5.5 0 0 1-.5-.5v-8.2Z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NavStudyIcon({ className, ...props }: NavIconProps) {
  return (
    <svg {...iconProps(className, props)}>
      <path
        d="M5 6.5 12 4l7 2.5v11.2a1 1 0 0 1-.65.94L12 20l-6.35-1.86A1 1 0 0 1 5 17.7V6.5Z"
        fill="currentColor"
        opacity="0.15"
      />
      <path
        d="M12 4v16M5 6.5 12 4l7 2.5M5 17.7l7 2.3 7-2.3"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NavBattlesIcon({ className, ...props }: NavIconProps) {
  return (
    <svg {...iconProps(className, props)}>
      <path d="M6 18 8 6l4 2 4-2 2 12" fill="currentColor" opacity="0.12" />
      <path
        d="M8 6 12 8l4-2M6 18h12M9 14h6"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function NavLeaderboardIcon({ className, ...props }: NavIconProps) {
  return (
    <svg {...iconProps(className, props)}>
      <rect x="4" y="12" width="4" height="8" rx="1" fill="currentColor" opacity="0.35" />
      <rect x="10" y="6" width="4" height="14" rx="1" fill="currentColor" />
      <rect x="16" y="9" width="4" height="11" rx="1" fill="currentColor" opacity="0.55" />
    </svg>
  );
}

export function NavProfileIcon({ className, ...props }: NavIconProps) {
  return (
    <svg {...iconProps(className, props)}>
      <circle cx="12" cy="8.5" r="3.5" fill="currentColor" opacity="0.2" />
      <circle cx="12" cy="8.5" r="3.5" stroke="currentColor" strokeWidth="1.75" />
      <path
        d="M5.5 19c.8-3.2 3.4-5 6.5-5s5.7 1.8 6.5 5"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
      />
    </svg>
  );
}
