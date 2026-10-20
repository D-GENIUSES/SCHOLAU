"use client";

import { type ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import styles from "./splash.module.css";

/** Display the approved three-second introduction once per browser-tab session. */
export function SplashGate({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const key = "scholau-splash-orbit-v1";
    try { if (sessionStorage.getItem(key)) return; } catch { /* Storage may be unavailable. */ }
    let timer: ReturnType<typeof setTimeout>;
    const frame = requestAnimationFrame(() => {
      try { sessionStorage.setItem(key, "seen"); } catch { /* The introduction still works without storage. */ }
      setVisible(true);
      timer = setTimeout(() => setVisible(false), 3000);
    });
    return () => { cancelAnimationFrame(frame); clearTimeout(timer); };
  }, []);
  return <>{children}{visible ? <div className={styles.screen} aria-hidden="true">
    <div className={styles.halo} />
    <div className={styles.signature}>
      <div className={styles.orbit}><svg viewBox="0 0 320 200" fill="none"><ellipse className={styles.trail} cx="160" cy="100" rx="146" ry="68" transform="rotate(-24 160 100)" pathLength="1" /></svg><span className={styles.spark}>✦</span></div>
      <div className={styles.logo}><Image src="/brand/splash-logo.svg" alt="" width={236} height={62} priority unoptimized /></div>
      <p className={styles.tagline}>Study. Compete. Rise.</p>
    </div>
    <div className={styles.footer}><span />A little learning. A little higher.</div>
  </div> : null}</>;
}
