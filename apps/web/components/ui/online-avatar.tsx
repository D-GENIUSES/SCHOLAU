import { Avatar } from "@/components/ui/avatar";

export function OnlineAvatar({ name, path, size, online, variant, eager, priority }: {
  name: string;
  path?: string | null;
  size: 32 | 40 | 56 | 72 | 96;
  online?: boolean;
  eager?: boolean;
  priority?: boolean;
  variant?: "default" | "profile";
}) {
  return <span className="online-avatar" data-size={size}>
    <Avatar name={name} path={path} size={size} publicProfile variant={variant} eager={eager} priority={priority} />
    {online ? <span className="online-avatar-dot" role="img" aria-label="Online now" title="Online now" /> : null}
  </span>;
}
