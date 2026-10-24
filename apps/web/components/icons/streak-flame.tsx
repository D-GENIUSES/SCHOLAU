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
  const id = active ? "streak-flame-active" : "streak-flame-idle";
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
            <linearGradient id={`${id}-g`} x1="12" y1="22" x2="12" y2="2" gradientUnits="userSpaceOnUse">
              <stop stopColor="#f7a033" />
              <stop offset="0.45" stopColor="#e85d1a" />
              <stop offset="1" stopColor="#c93a0a" />
            </linearGradient>
          </defs>
          <path
            d="M12 2c-1.2 3.2-3.8 4.8-3.8 8.2 0 2.1 1.1 3.5 2.3 4.5-.4-2.8 1.2-4.2 2.5-5.8.8 1.6.5 3.4-.2 5 1.4-1.1 2.7-2.8 2.7-5.2C15.5 6.2 13.4 4.2 12 2Z"
            fill={`url(#${id}-g)`}
          />
          <path
            d="M12 11.5c-.9 1.4-2.2 2.6-2.2 4.5 0 2.5 2 4.5 4.5 4.5s4.5-2 4.5-4.5c0-2.6-2.4-4.2-3.5-6.2-.6 1.5-1.5 2.5-3.3 1.7Z"
            fill="#ffe8c8"
            opacity="0.95"
          />
        </>
      ) : (
        <path
          d="M12 3.2c-1 2.6-3.2 3.9-3.2 6.8 0 1.8.9 3 1.9 3.8-.3-2.3.9-3.5 2-4.8.7 1.3.4 2.8-.2 4.1 1.2-.9 2.2-2.3 2.2-4.3 0-2.8-2-4.5-2.7-5.6Zm0 8.3c-.8 1.2-1.9 2.2-1.9 3.9 0 2.2 1.8 4 4 4s4-1.8 4-4c0-2.2-2.1-3.6-3.1-5.3-.5 1.3-1.3 2.1-2.9 1.4Z"
          fill="currentColor"
          opacity="0.85"
        />
      )}
    </svg>
  );
}
