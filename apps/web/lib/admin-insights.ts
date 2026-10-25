import { useQuery } from "@tanstack/react-query";

import { getBrowserSupabase } from "@/lib/supabase/browser";

export type UserInsight = { id: string; department: string | null; faculty: string | null; level: string | null; online: boolean; events: { id: string; label: string; at: string }[] };

export type BattleInsight = { id: string; course: string; rounds: number; winner_id: string | null; players: { id: string; name: string; score: number | null; forfeited: boolean }[] };

export function useUserInsights(ids: string[]) {

 return useQuery({ queryKey: ["admin-user-insights", ids], queryFn: async () => {

 const {data,error}=await getBrowserSupabase().rpc("admin_user_insights_v1",{p_user_ids:ids});

 if(error) throw error;

 return data as {items: UserInsight[]; total_users: number; resets_at: string};

 }, refetchInterval: 15000 });

}

export function useBattleInsights(ids: string[]) {

 return useQuery({ queryKey: ["admin-battle-insights", ids], enabled: ids.length>0, queryFn: async () => {

 const {data,error}=await getBrowserSupabase().rpc("admin_battle_players_v1",{p_battle_ids:ids});

 if(error) throw error;

 return data as {items: BattleInsight[]};

 }, refetchInterval: 15000 });

}

