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
        d="M12 3.2 4.5 9.2v10.3c0 .55.45 1 1 1h5.5v-6h6v6H18.5c.55 0 1-.45 1-1V9.2L12 3.2Z"
        fill="currentColor"
      />
      <path
        d="M12 5.8 6.5 10.2V19h3.5v-5.5h7V19H17.5v-8.8L12 5.8Z"
        fill="currentColor"
        opacity="0.22"
      />
    </svg>
  );
}

/** People — Social tab (placeholder until product is defined). */
export function NavSocialIcon({ className, ...props }: NavIconProps) {
  return (
    <svg {...iconProps(className, props)}>
      <circle cx="9" cy="9" r="3.25" fill="currentColor" />
      <circle cx="16.5" cy="10" r="2.75" fill="currentColor" opacity="0.55" />
      <path
        d="M4.5 18.5c.65-2.85 2.85-4.5 4.5-4.5s3.85 1.65 4.5 4.5M13.5 17.5c.45-1.65 1.65-2.75 3-2.75 1.1 0 2.05.65 2.55 2.75"
        fill="currentColor"
      />
    </svg>
  );
}

/** Open book — used in app chrome / course links. */
export function NavStudyIcon({ className, ...props }: NavIconProps) {
  return (
    <svg {...iconProps(className, props)}>
      <path
        d="M12 4.2c-4.35 0-7.75 1.25-7.75 2.85V18.4c0 .75.62 1.35 1.38 1.35.42 0 .82-.2 1.08-.52L12 16.5l5.29 3.73c.26.32.66.52 1.08.52.76 0 1.38-.6 1.38-1.35V7.05c0-1.6-3.4-2.85-7.75-2.85Z"
        fill="currentColor"
      />
      <path
        d="M12 4.2v14.8M5.63 7.05 12 9.85l6.37-2.8M5.63 17.55 12 14.75l6.37 2.8"
        stroke="currentColor"
        strokeWidth="1.15"
        strokeLinecap="round"
        strokeLinejoin="round"
        opacity="0.28"
      />
    </svg>
  );
}

export function NavBattlesIcon({ className, ...props }: NavIconProps) {
  return (
    <svg {...iconProps(className, props)}>
      <path
        d="m7.2 18.5 1.8-8.2 3.5 1.5-1.8 8.2-3.5-1.5ZM16.8 18.5l-1.8-8.2-3.5 1.5 1.8 8.2 3.5-1.5Z"
        fill="currentColor"
        opacity="0.35"
      />
      <path
        d="m8.5 17.2 2.2-9.5 2.8 1.2-2.2 9.5-2.8-1.2ZM15.5 17.2l-2.2-9.5-2.8 1.2 2.2 9.5 2.8-1.2Z"
        fill="currentColor"
      />
      <circle cx="12" cy="5.5" r="2.2" fill="currentColor" />
      <path
        d="M10.2 7.2 12 9l1.8-1.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function NavLeaderboardIcon({ className, ...props }: NavIconProps) {
  return (
    <svg {...iconProps(className, props)}>
      <rect x="3.5" y="12" width="5" height="9" rx="1.2" fill="currentColor" opacity="0.45" />
      <rect x="9.5" y="5" width="5" height="16" rx="1.2" fill="currentColor" />
      <rect x="15.5" y="9" width="5" height="12" rx="1.2" fill="currentColor" opacity="0.65" />
      <path
        d="M12 2.5 13.1 5h2.4l-2 1.5.8 2.4L12 7.4 9.7 8.9l.8-2.4-2-1.5h2.4L12 2.5Z"
        fill="currentColor"
        opacity="0.9"
      />
    </svg>
  );
}

export function NavProfileIcon({ className, ...props }: NavIconProps) {
  return (
    <svg {...iconProps(className, props)}>
      <circle cx="12" cy="12" r="9.5" fill="currentColor" opacity="0.15" />
      <circle cx="12" cy="9" r="3.75" fill="currentColor" />
      <path
        d="M5.8 19.2c.85-3.35 3.55-5.2 6.2-5.2s5.35 1.85 6.2 5.2"
        fill="currentColor"
      />
    </svg>
  );
}
