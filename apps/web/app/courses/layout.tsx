import type { ReactNode } from "react";

/** Public course pages and signed-in challenge pages share this URL prefix. */
export default function CoursesLayout({ children }: { children: ReactNode }) {
  return children;
}
