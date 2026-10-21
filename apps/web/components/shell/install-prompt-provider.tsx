"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

interface InstallEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const InstallContext = createContext({
  ready: false, ios: false, installed: false, available: false,
  install: async (): Promise<boolean> => false,
});

/** Capture the browser event before signup/onboarding navigates to Home. */
export function InstallPromptProvider({ children }: { children: ReactNode }) {
  const [environment, setEnvironment] = useState({ ready: false, ios: false, installed: false });
  const [prompt, setPrompt] = useState<InstallEvent | null>(null);
  useEffect(() => {
    const media = window.matchMedia("(display-mode: standalone)");
    let active = true;
    const refresh = () => {
      if (active) setEnvironment({
        ready: true,
        ios: /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
        installed: media.matches || Boolean((navigator as Navigator & { standalone?: boolean }).standalone),
      });
    };
    const capture = (event: Event) => { event.preventDefault(); setPrompt(event as InstallEvent); };
    const installed = () => { setPrompt(null); setEnvironment(value => ({ ...value, installed: true })); };
    queueMicrotask(refresh);
    window.addEventListener("beforeinstallprompt", capture);
    window.addEventListener("appinstalled", installed);
    media.addEventListener("change", refresh);
    return () => { active = false; window.removeEventListener("beforeinstallprompt", capture); window.removeEventListener("appinstalled", installed); media.removeEventListener("change", refresh); };
  }, []);
  async function install() {
    if (!prompt) return false;
    // A captured install prompt is single-use and must run directly from a tap.
    setPrompt(null);
    await prompt.prompt();
    const accepted = (await prompt.userChoice).outcome === "accepted";
    if (accepted) setEnvironment(value => ({ ...value, installed: true }));
    return accepted;
  }
  return <InstallContext.Provider value={{ ...environment, available: Boolean(prompt), install }}>{children}</InstallContext.Provider>;
}

export const useInstallPrompt = () => useContext(InstallContext);
