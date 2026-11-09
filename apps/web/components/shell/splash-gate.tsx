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
        const player = video.current;
        if (!player) return finishLaunch();
        player.src = "/brand/splash-bounce-centered.mp4";
        void player.play().catch(finishLaunch);
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
          preload="none"
          disablePictureInPicture
          onPlaying={() => setPlaying(true)}
          onEnded={finishLaunch}
          onError={finishLaunch}
        />
        <div className={styles.intro}><SplashLogo /></div>
      </div>
      {children}
    </>
  );
}

function finishLaunch() {
  document.documentElement.dataset.scholauLaunch = "warm";
}
