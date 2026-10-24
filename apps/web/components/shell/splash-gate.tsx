import { type ReactNode } from "react";
import { SplashLogo } from "./splash-logo";
import styles from "./splash.module.css";

/** The head bootstrap shows this only for a new app session, before first paint. */
export function SplashGate({ children }: { children: ReactNode }) {
  return <><div data-scholau-splash="blue-orbit" className={styles.screen} aria-hidden="true" style={{ position: "fixed", inset: 0, zIndex: 1000, placeItems: "center", overflow: "hidden", pointerEvents: "auto", color: "white", background: "#0866e8" }}>
    <div className={styles.halo} />
    <div className={styles.signature}>
      <div className={styles.logo}><SplashLogo /></div>
    </div>
  </div>{children}</>;
}
