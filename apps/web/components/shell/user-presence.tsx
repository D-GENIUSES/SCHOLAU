"use client";
import { useEffect } from "react";
import { getBrowserSupabase } from "@/lib/supabase/browser";
export function UserPresence({userId}: {userId: string}) {
 useEffect(() => {
 const heartbeat=()=>{if(document.visibilityState==="visible") void getBrowserSupabase().rpc("user_heartbeat_v1").then(()=>{});};
 heartbeat(); const timer=setInterval(heartbeat,30000);
 document.addEventListener("visibilitychange",heartbeat);
 return ()=>{clearInterval(timer);document.removeEventListener("visibilitychange",heartbeat);};
 },[userId]);
 return null;
}
