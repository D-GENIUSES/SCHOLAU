"use client";

import { type ReactNode, useEffect, useRef, useState } from "react";
import { SplashLogo } from "./splash-logo";
import styles from "./splash.module.css";

export function SplashGate({ children }: { children: ReactNode }) {
  const video = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    if (document.documentElement.dataset.scholauLaunch !== "cold") return;
    const timer = window.setTimeout(() => {
      if (document.documentElement.dataset.scholauLaunch === "cold") {
        void video.current?.play().catch(finishLaunch);
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <>
      <div data-scholau-splash="blue-orbit" data-playing={playing} className={styles.screen} aria-hidden="true">
        <video
          ref={video}
          className={styles.video}
          muted
          playsInline
          preload="auto"
          disablePictureInPicture
          onPlaying={() => setPlaying(true)}
          onEnded={finishLaunch}
          onError={finishLaunch}
        >
          <source src="/brand/splash-bounce-centered.mp4" type="video/mp4" />
        </video>
        <div className={styles.intro}><SplashLogo /></div>
      </div>
      {children}
    </>
  );
}

function finishLaunch() {
  document.documentElement.dataset.scholauLaunch = "warm";
}
