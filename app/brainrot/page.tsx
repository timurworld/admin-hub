"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { supabase, GAME_ID, EFFECTS } from "@/lib/supabase";
import { usePresence } from "@/lib/usePresence";
import LiveEventBlock from "./components/LiveEventBlock";
import EventScheduler from "./components/EventScheduler";
import GlobalMessage from "./components/GlobalMessage";
import PlayerVote from "./components/PlayerVote";
import GiveCoins from "./components/GiveCoins";
import GiveSkin from "./components/GiveSkin";
import DJEffects from "./components/DJEffects";
import LivePreview from "./components/LivePreview";

export default function BrainrotAdmin() {
  const [eventActive, setEventActive] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const online = usePresence();

  useEffect(() => {
    async function fetchEvent() {
      const { data } = await supabase.from("admin_events").select("active").eq("game_id", GAME_ID).single();
      if (data) setEventActive(data.active);
    }
    async function fetchPlayers() {
      const { count } = await supabase.from("leaderboard").select("*", { count: "exact", head: true });
      setPlayerCount(count || 0);
    }
    fetchEvent();
    fetchPlayers();
    const playerInt = setInterval(fetchPlayers, 10000);

    const sub = supabase.channel("admin-events-header")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_events" }, (payload) => {
        const row = payload.new as { active?: boolean };
        if (row?.active !== undefined) setEventActive(row.active);
      })
      .subscribe();

    return () => { clearInterval(playerInt); supabase.removeChannel(sub); };
  }, []);

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      {/* Top bar */}
      <header style={{
        background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)",
        padding: "12px 24px", display: "flex", justifyContent: "space-between", alignItems: "center",
        position: "sticky", top: 0, zIndex: 50,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <Link href="/" style={{
            color: "var(--color-text-muted)", fontSize: 13, textDecoration: "none",
            padding: "6px 12px", borderRadius: 8, border: "1px solid var(--color-border)",
            transition: "all 0.2s",
          }}
          onMouseEnter={e => { (e.target as HTMLElement).style.color = "#fff"; (e.target as HTMLElement).style.borderColor = "var(--color-border-hover)"; }}
          onMouseLeave={e => { (e.target as HTMLElement).style.color = "var(--color-text-muted)"; (e.target as HTMLElement).style.borderColor = "var(--color-border)"; }}
          >← All games</Link>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{
              width: 32, height: 32, borderRadius: 8,
              background: "rgba(162,89,255,0.15)",
              display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
            }}>🧠</div>
            <div>
              <div className="font-heading" style={{ fontSize: 15, color: "#fff", lineHeight: 1.1 }}>Brainrot Clicker</div>
              <div style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-jetbrains)" }}>game.timur.world</div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{
            display: "flex", alignItems: "center", gap: 8,
            padding: "6px 12px", borderRadius: 8,
            background: "var(--color-card)", border: "1px solid var(--color-border)",
          }} title={`${online.size} live now · ${playerCount} total registered`}>
            <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-green)" }} />
            <span className="font-mono" style={{ fontSize: 13, color: "#fff" }}>{online.size}</span>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>live</span>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>·</span>
            <span className="font-mono" style={{ fontSize: 12, color: "var(--color-text-muted)" }}>{playerCount}</span>
            <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>total</span>
          </div>
          <button onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }} style={{
            padding: "6px 12px", borderRadius: 8, background: "transparent",
            border: "1px solid var(--color-border)", color: "var(--color-text-muted)",
            cursor: "pointer", fontSize: 12,
          }}>Log out</button>
        </div>
      </header>

      {/* Two column layout */}
      <div style={{ display: "grid", gridTemplateColumns: "minmax(300px, 360px) 1fr", gap: 0, minHeight: "calc(100vh - 61px)" }}>
        {/* Left — controls */}
        <aside style={{
          background: "var(--color-surface)", borderRight: "1px solid var(--color-border)",
          padding: "20px 16px", overflow: "auto", maxHeight: "calc(100vh - 61px)",
          display: "flex", flexDirection: "column", gap: 16,
        }}>
          <LiveEventBlock onChange={setEventActive} />
          <EventScheduler />
          <GlobalMessage />
          <PlayerVote />
          <GiveCoins />
          <GiveSkin />
          <DJEffects locked={!eventActive} />
        </aside>

        {/* Right — live preview */}
        <div style={{ position: "relative", background: "var(--color-bg)", overflow: "hidden" }}>
          <LivePreview />
        </div>
      </div>
    </div>
  );
}
