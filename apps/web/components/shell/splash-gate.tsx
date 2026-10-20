"use client";

import { type ReactNode, useEffect, useState } from "react";
import Image from "next/image";
import styles from "./splash.module.css";

/** Display the approved three-second introduction once per browser-tab session. */
export function SplashGate({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const key = "scholau-splash-orbit-v2";
    let seen = false;
    try { seen = Boolean(sessionStorage.getItem(key)); } catch { /* Storage may be unavailable. */ }
    const timer = setTimeout(() => {
      try { sessionStorage.setItem(key, "seen"); } catch { /* Animation still works without storage. */ }
      setVisible(false);
    }, seen ? 0 : 3000);
    return () => clearTimeout(timer);
  }, []);
  return <>{visible ? <div data-scholau-splash="blue-orbit" className={styles.screen} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 1000, display: "grid", placeItems: "center", overflow: "hidden", pointerEvents: "none", color: "white", background: "#0866e8" }}>
    <div className={styles.halo} />
    <div className={styles.signature}>
      <div className={styles.orbit}><svg viewBox="0 0 320 200" fill="none"><ellipse className={styles.trail} cx="160" cy="100" rx="146" ry="68" transform="rotate(-24 160 100)" pathLength="1" /></svg><span className={styles.spark}>✦</span></div>
      <div className={styles.logo}><Image src="/brand/splash-logo.svg" alt="" width={236} height={62} priority unoptimized /></div>
      <p className={styles.tagline}>Study. Compete. Rise.</p>
    </div>
    <div className={styles.footer}><span />A little learning. A little higher.</div>
  </div> : null}{children}</>;
}
