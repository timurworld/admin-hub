// React hook that resolves the current admin's tier from the players table.
// Tier semantics (mirrors scripts/sql/24_admin_tiers.sql in the game repo):
//   0 = regular player
//   1 = admin (TmoneyAdmin level — current tools)
//   2 = god admin (EmoneyAdmin level — admin tools + god-only tools)
//   3+ reserved
//
// Use it in components that need to gate UI by tier:
//   const { isAdmin, isGodAdmin } = useAdminTier();
//   {isGodAdmin && <BotTools />}

"use client";

import { useEffect, useState } from "react";
import { supabase } from "./supabase";
import { getAdminPlayerCreds } from "./adminPlayerAuth";

export interface AdminTierState {
  tier: number;
  isAdmin: boolean;
  isGodAdmin: boolean;
  loading: boolean;
}

export function useAdminTier(): AdminTierState {
  const [tier, setTier] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const creds = getAdminPlayerCreds();
    if (!creds) { setLoading(false); return; }

    let cancelled = false;
    (async () => {
      const { data } = await supabase
        .from("players")
        .select("admin_tier")
        .ilike("username", creds.username)
        .maybeSingle();
      if (cancelled) return;
      setTier((data?.admin_tier as number | undefined) ?? 0);
      setLoading(false);
    })();

    return () => { cancelled = true; };
  }, []);

  return {
    tier,
    isAdmin: tier >= 1,
    isGodAdmin: tier >= 2,
    loading,
  };
}
