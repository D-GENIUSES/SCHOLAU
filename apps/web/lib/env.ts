import { clientHeaders } from "@scholau/api";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "http://127.0.0.1:54321";
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const APP_BUILD = Number(process.env.NEXT_PUBLIC_APP_BUILD ?? "1") || 1;

export const isSupabaseConfigured = SUPABASE_ANON_KEY.length > 0;

export const webClientHeaders = clientHeaders("web", APP_BUILD);
