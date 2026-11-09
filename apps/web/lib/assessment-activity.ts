export type WindowActivity = "app_hidden" | "focus_lost" | "possible_split_screen" | "fullscreen_exit";
export type CaptureShortcut = "screenshot_shortcut" | "recording_shortcut" | "casting_shortcut";

export function captureShortcut(event: Pick<KeyboardEvent, "key" | "code" | "metaKey" | "altKey" | "shiftKey" | "ctrlKey">, platform: string): CaptureShortcut | null {
  if (event.key === "PrintScreen") return "screenshot_shortcut";
  if (!event.metaKey || event.ctrlKey) return null;
  if (platform.startsWith("Win")) {
    if (event.altKey && !event.shiftKey && event.code === "KeyR") return "recording_shortcut";
    if (!event.altKey && !event.shiftKey && event.code === "KeyK") return "casting_shortcut";
    if (!event.altKey && event.shiftKey && event.code === "KeyS") return "screenshot_shortcut";
  }
  if (platform.startsWith("Mac") && event.shiftKey && !event.altKey &&
    ["Digit3", "Digit4"].includes(event.code)) return "screenshot_shortcut";
  return null;
}

export function observeAssessmentWindow(flag: (kind: WindowActivity) => void, onReturn: () => void) {
  let away = false;
  let smallWindow = false;
  let resizeTimer: ReturnType<typeof setTimeout>;
  const departure = (kind: WindowActivity) => { if (!away) { away = true; flag(kind); } };
  const focus = () => {
    if (!document.hidden && document.hasFocus()) away = false;
    onReturn();
  };
  const visibility = () => { if (document.hidden) departure("app_hidden"); else focus(); };
  const blur = () => departure("focus_lost");
  const fullscreen = () => { if (!document.fullscreenElement) flag("fullscreen_exit"); };
  const checkWindow = () => {
    // Window dimensions avoid treating zoom and the on-screen keyboard as split screen.
    const { availWidth, availHeight } = window.screen;
    const small = availWidth > 0 && availHeight > 0 && window.outerWidth > 0 && window.outerHeight > 0 &&
      window.outerWidth < availWidth * 0.55;
    if (small && !smallWindow) flag("possible_split_screen");
    smallWindow = small;
  };
  const resize = () => { clearTimeout(resizeTimer); resizeTimer = setTimeout(checkWindow, 1000); };

  document.addEventListener("visibilitychange", visibility);
  window.addEventListener("blur", blur);
  window.addEventListener("focus", focus);
  document.addEventListener("fullscreenchange", fullscreen);
  window.addEventListener("resize", resize);
  checkWindow();
  visibility();

  return () => {
    clearTimeout(resizeTimer);
    document.removeEventListener("visibilitychange", visibility);
    window.removeEventListener("blur", blur);
    window.removeEventListener("focus", focus);
    document.removeEventListener("fullscreenchange", fullscreen);
    window.removeEventListener("resize", resize);
  };
}
