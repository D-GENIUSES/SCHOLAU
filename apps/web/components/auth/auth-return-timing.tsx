"use client";

import { useEffect } from "react";
import { measureGoogleReturn } from "@/lib/auth-timing";

export function AuthReturnTiming() {
  useEffect(() => {
    measureGoogleReturn();
    window.addEventListener("pageshow", measureGoogleReturn);
    return () => window.removeEventListener("pageshow", measureGoogleReturn);
  }, []);
  return null;
}
