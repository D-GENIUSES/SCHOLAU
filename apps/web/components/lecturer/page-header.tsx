import type { ReactNode } from "react";

/** Compact page title for lecturer workspace routes. */
export function LecturerPageHeader({
  title,
  description,
  actions,
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-4 flex flex-col gap-2.5 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-[1.35rem]">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-xs leading-relaxed text-ink-muted sm:text-sm">{description}</p> : null}
      </div>
      {actions ? <div className="flex min-w-0 shrink-0 flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
