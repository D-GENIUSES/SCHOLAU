"use client";
import { useEffect } from "react";
import { usePathname } from "next/navigation";

/** Keep native app scale and limit copy and selection outside privacy and terms. */
export function ViewportLock() {
  const pathname = usePathname();
  useEffect(() => {
    const preventZoomWheel = (event: WheelEvent) => { if (event.ctrlKey || event.metaKey) event.preventDefault(); };
    const preventZoomKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && ["+", "=", "-", "0"].includes(event.key)) event.preventDefault();
    };
    const preventGesture = (event: Event) => event.preventDefault();
    const preventPinch = (event: TouchEvent) => { if (event.touches.length > 1) event.preventDefault(); };
    document.addEventListener("wheel", preventZoomWheel, { passive: false });
    document.addEventListener("keydown", preventZoomKey);
    document.addEventListener("gesturestart", preventGesture, { passive: false });
    document.addEventListener("gesturechange", preventGesture, { passive: false });
    document.addEventListener("touchmove", preventPinch, { passive: false });
    return () => {
      document.removeEventListener("wheel", preventZoomWheel);
      document.removeEventListener("keydown", preventZoomKey);
      document.removeEventListener("gesturestart", preventGesture);
      document.removeEventListener("gesturechange", preventGesture);
      document.removeEventListener("touchmove", preventPinch);
    };
  }, []);
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
