import type { ReactNode } from "react";

export function AuthHeading({ title, description }: { title: ReactNode; description?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-col gap-1">
      <h1 className="text-2xl font-bold">{title}</h1>
      {description ? <p className="text-ink-muted">{description}</p> : null}
    </div>
  );
}
