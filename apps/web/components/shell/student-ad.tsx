"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";
import { adsensePublisher } from "@/lib/adsense";

type AdWindow = Window & { adsbygoogle?: object[] };

const adSlot = process.env.NEXT_PUBLIC_ADSENSE_SLOT_ID;
const adsEnabled = process.env.NEXT_PUBLIC_ADSENSE_ENABLED === "true";
const eligiblePage = /^\/(?:home|courses(?:\/[^/]+)*|study(?:\/(?!assessments(?:\/|$))[^/]+)*|leaderboard)\/?$/;

export function StudentAd({ pathname }: { pathname: string }) {
  if (!adsEnabled || !adsensePublisher || !adSlot || !/^\d+$/.test(adSlot) || !eligiblePage.test(pathname)) {
    return null;
  }

  return <AdBanner key={pathname} publisher={adsensePublisher} slot={adSlot} />;
}

function AdBanner({ publisher, slot }: { publisher: string; slot: string }) {
  const ad = useRef<HTMLModElement>(null);

  useEffect(() => {
    const element = ad.current;
    if (!element || element.dataset.requested || element.offsetWidth === 0) return;

    element.dataset.requested = "true";
    const browser = window as AdWindow;
    (browser.adsbygoogle ??= []).push({});
  }, []);

  return (
    <>
      <Script
        src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${publisher}`}
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />
      <aside aria-label="Advertisement" className="mt-8 max-w-full [&:has(ins[data-ad-status=unfilled])]:hidden">
        <ins
          ref={ad}
          className="adsbygoogle block"
          data-ad-client={publisher}
          data-ad-slot={slot}
          data-ad-format="horizontal"
        />
      </aside>
    </>
  );
}
