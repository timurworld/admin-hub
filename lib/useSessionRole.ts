// Reads the role baked into the site session cookie via /api/auth/me.
// This is the SECURITY boundary — UI that should be locked behind EmoneyAdmin
// must gate on `isGodAdmin` from this hook, not on useAdminTier (which only
// reflects the in-game player's tier, switchable by anyone who knows a PIN).

"use client";

import { useEffect, useState } from "react";

export type SessionRole = "god" | "admin" | null;

export interface SessionRoleState {
  role: SessionRole;
  isGodAdmin: boolean;
  loading: boolean;
}

export function useSessionRole(): SessionRoleState {
  const [role, setRole] = useState<SessionRole>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/auth/me", { cache: "no-store" });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        setRole(res.ok ? (data.role as SessionRole) : null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { role, isGodAdmin: role === "god", loading };
}
