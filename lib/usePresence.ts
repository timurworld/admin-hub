"use client";

import { useEffect, useState } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabase";

/**
 * Singleton presence channel. Multiple components can call usePresence —
 * they all share one Supabase subscription and get notified via listeners.
 */
let channel: RealtimeChannel | null = null;
let onlineSet: Set<string> = new Set();
const listeners = new Set<(s: Set<string>) => void>();

function ensureChannel() {
  if (channel) return;
  channel = supabase.channel("brainrot:presence");
  channel
    .on("presence", { event: "sync" }, () => {
      const state = channel!.presenceState() as Record<string, unknown[]>;
      onlineSet = new Set(Object.keys(state));
      listeners.forEach((l) => l(onlineSet));
    })
    .subscribe();
}

/**
 * Returns the current Set of online usernames (lowercased) and re-renders
 * whenever the presence state changes.
 */
export function usePresence(): Set<string> {
  const [online, setOnline] = useState<Set<string>>(onlineSet);

  useEffect(() => {
    ensureChannel();
    const update = (s: Set<string>) => setOnline(new Set(s));
    listeners.add(update);
    // If we already have a state, push it to the new subscriber immediately
    if (onlineSet.size > 0) update(onlineSet);
    return () => {
      listeners.delete(update);
    };
  }, []);

  return online;
}
