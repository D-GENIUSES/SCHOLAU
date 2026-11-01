"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Keep the installed-web-app scale stable, as requested by the product owner. */
export function ViewportLock() {
  const pathname = usePathname();
  useEffect(() => {
    const readablePolicy = pathname === "/privacy" || pathname === "/terms";
    document.documentElement.classList.toggle("native-app-interactions", !readablePolicy);
    if (readablePolicy) return;
    const isEditable = (target: EventTarget | null) => {
      const element = target instanceof Element ? target : null;
      const field = element?.closest("input, textarea, [contenteditable]");
      return field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement ||
        (field instanceof HTMLElement && field.isContentEditable);
    };
    const preventContentAction = (event: Event) => {
      if (!isEditable(event.target)) event.preventDefault();
    };
    const contentEvents = ["copy", "cut", "contextmenu", "selectstart", "dragstart"] as const;
    for (const type of contentEvents) document.addEventListener(type, preventContentAction, true);
    return () => {
      document.documentElement.classList.remove("native-app-interactions");
      for (const type of contentEvents) document.removeEventListener(type, preventContentAction, true);
    };
  }, [pathname]);
  return null;
}
