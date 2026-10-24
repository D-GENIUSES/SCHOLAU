import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface Column<T> {
  key: string;
  header: string;
  cell: (row: T) => ReactNode;
  /** Rendered as a button row at the bottom of each mobile card. */
  action?: boolean;
  className?: string;
}

/** Accessible table on md+ and a card list below md (works at 320px). The first column is the row header. */
export function DataTable<T>({
  caption,
  columns,
  rows,
  rowKey,
  isSelected,
}: {
  caption: string;
  columns: Column<T>[];
  rows: readonly T[];
  rowKey: (row: T) => string;
  isSelected?: (row: T) => boolean;
}) {
  const dataCols = columns.filter((c) => !c.action);
  const actionCols = columns.filter((c) => c.action);
  return (
    <>
      <div className="hidden overflow-x-auto rounded-card border border-line bg-surface-card shadow-card md:block">
        <table className="w-full border-collapse text-left text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead className="bg-surface-page">
            <tr>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="px-3 py-2 text-xs font-semibold whitespace-nowrap text-ink-muted">
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={rowKey(row)} className={cn("border-t border-line align-top", isSelected?.(row) && "bg-surface-tint")}>
                {columns.map((c, idx) =>
                  idx === 0 ? (
                    <th key={c.key} scope="row" className={cn("px-3 py-2 text-left text-sm font-semibold text-ink", c.className)}>
                      {c.cell(row)}
                    </th>
                  ) : (
                    <td key={c.key} className={cn("px-3 py-2 text-sm text-ink", c.className)}>
                      {c.cell(row)}
                    </td>
                  ),
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <ul className="flex flex-col gap-3 md:hidden" aria-label={caption}>
        {rows.map((row) => (
          <li
            key={rowKey(row)}
            className={cn(
              "min-w-0 rounded-card border bg-surface-card p-4 shadow-card",
              isSelected?.(row) ? "border-brand-primary" : "border-line",
            )}
          >
            <dl className="flex flex-col gap-2">
              {dataCols.map((c) => (
                <div key={c.key} className="min-w-0">
                  <dt className="text-sm text-ink-muted">{c.header}</dt>
                  <dd className="break-words">{c.cell(row)}</dd>
                </div>
              ))}
            </dl>
            {actionCols.length > 0 ? (
              <div className="mt-3 flex flex-wrap gap-2">
                {actionCols.map((c) => (
                  <div key={c.key}>{c.cell(row)}</div>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </>
  );
}
