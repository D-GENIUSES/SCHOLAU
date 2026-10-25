"use client";

import { type ReactNode } from "react";
import styles from "./splash.module.css";

export function SplashGate({ children }: { children: ReactNode }) {
  return <><div data-scholau-splash="blue-orbit" className={styles.screen} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 1000, placeItems: "center", overflow: "hidden", background: "#f3f7fc" }}>
    <video className={styles.video} autoPlay muted playsInline preload="auto" poster="/brand/splash-bounce-poster.jpg" disablePictureInPicture
      onEnded={() => { document.documentElement.dataset.scholauLaunch = "warm"; }}
      onError={() => { document.documentElement.dataset.scholauLaunch = "warm"; }}>
      <source src="/brand/splash-bounce.mp4" type="video/mp4" />
    </video>
  </div>{children}</>;
}
