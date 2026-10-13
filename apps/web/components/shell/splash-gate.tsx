"use client";
import { useEffect, useState, type ReactNode } from "react";
import { LogoMark } from "@/components/logo";

const SPLASH_KEY = "scholau:splash-seen:v1";
/** One three-second welcome per tab session. Storage failure still lets the app open. */
export function SplashGate({ children }: { children: ReactNode }) {
  const [showing, setShowing] = useState(true);
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem(SPLASH_KEY) === "yes"; } catch { /* Private browsing can restrict storage. */ }
    const timer = window.setTimeout(() => {
      try { sessionStorage.setItem(SPLASH_KEY, "yes"); } catch { /* Opening the dashboard must not depend on storage. */ }
      setShowing(false);
    }, seen ? 0 : 3000);
    return () => window.clearTimeout(timer);
  }, []);
  return <>{showing ? <div className="splash-screen" role="status" aria-label="Welcome to ScholAu. Opening your dashboard."><div className="splash-glow" aria-hidden /><div className="splash-brand"><LogoMark className="!size-28 sm:!size-36" /><span className="splash-wordmark">ScholAu</span><p>Study. Compete. Rise.</p></div><span className="splash-loader" aria-hidden /><p className="splash-footer">A little learning. A brighter future.</p></div> : null}<div hidden={showing}>{children}</div></>;
}
