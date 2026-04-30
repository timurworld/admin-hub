"use client";

import { useEffect, useState, useRef, useCallback } from "react";
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
import SpawnDropEvent from "./components/SpawnDropEvent";
import SpawnLocker from "./components/SpawnLocker";
import StatusStrip from "./components/StatusStrip";
import CollapsibleCard from "./components/CollapsibleCard";

const SPLIT_KEY = "brainrot_admin_split_px";
const MIN_LEFT = 320;
const MAX_LEFT = 1100;

function SectionHeader({ id, children }: { id?: string; children: React.ReactNode }) {
  return (
    <div id={id} style={{
      fontSize: 10, color: "var(--color-text-muted)",
      letterSpacing: "0.18em", textTransform: "uppercase",
      padding: "12px 4px 4px",
      borderTop: "1px solid var(--color-border)",
      marginTop: 8,
    }}>{children}</div>
  );
}

export default function BrainrotAdmin() {
  const [eventActive, setEventActive] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const online = usePresence();

  // Resizable split between controls (left) and live preview (right). Persisted.
  const [leftWidth, setLeftWidth] = useState<number>(540);
  const [dragging, setDragging] = useState(false);
  useEffect(() => {
    const saved = parseInt(localStorage.getItem(SPLIT_KEY) || "");
    if (!isNaN(saved) && saved >= MIN_LEFT && saved <= MAX_LEFT) setLeftWidth(saved);
  }, []);
  const onSplitterDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
  }, []);
  useEffect(() => {
    if (!dragging) return;
    const onMove = (e: MouseEvent) => {
      const w = Math.min(MAX_LEFT, Math.max(MIN_LEFT, e.clientX));
      setLeftWidth(w);
    };
    const onUp = () => {
      setDragging(false);
      try { localStorage.setItem(SPLIT_KEY, String(Math.round(leftWidth))); } catch {}
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [dragging, leftWidth]);

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

      {/* Resizable two-column layout */}
      <div style={{
        display: "flex", minHeight: "calc(100vh - 61px)",
        userSelect: dragging ? "none" : "auto",
        cursor: dragging ? "col-resize" : "auto",
      }}>
        {/* Left — controls */}
        <aside style={{
          width: leftWidth, flexShrink: 0,
          background: "var(--color-surface)",
          padding: "16px 14px", overflow: "auto", maxHeight: "calc(100vh - 61px)",
          display: "flex", flexDirection: "column", gap: 8,
        }}>
          <StatusStrip />

          {/* LIVE — toggle, scheduler, message */}
          <SectionHeader id="section-live">Live Control</SectionHeader>
          <CollapsibleCard id="live-event" icon="🔴" title="Live Event" defaultOpen accent="var(--color-red)">
            <LiveEventBlock onChange={setEventActive} />
          </CollapsibleCard>
          <CollapsibleCard id="scheduler" icon="📅" title="Schedule Event" defaultOpen={false}>
            <EventScheduler />
          </CollapsibleCard>
          <CollapsibleCard id="global-message" icon="📢" title="Broadcast Message" defaultOpen={false} forceOpen={eventActive}>
            <GlobalMessage />
          </CollapsibleCard>

          {/* REWARDS — coins, skins */}
          <SectionHeader id="section-rewards">Player Rewards</SectionHeader>
          <CollapsibleCard id="give-coins" icon="🪙" title="Give Coins" defaultOpen={false}>
            <GiveCoins />
          </CollapsibleCard>
          <CollapsibleCard id="give-skin" icon="🎁" title="Give Skin" defaultOpen={false}>
            <GiveSkin />
          </CollapsibleCard>

          {/* V2 EVENTS — drops + locker */}
          <SectionHeader id="section-events">V2 Events</SectionHeader>
          <CollapsibleCard id="drop-event" icon="🎁" title="Drop Event" defaultOpen={false} accent="rgba(255,200,80,0.5)">
            <SpawnDropEvent />
          </CollapsibleCard>
          <CollapsibleCard id="locker" icon="🔐" title="Locker" defaultOpen={false} accent="#ffd700">
            <SpawnLocker />
          </CollapsibleCard>

          {/* DJ BOOTH — vote, effects */}
          <SectionHeader id="section-djbooth">DJ Booth</SectionHeader>
          <CollapsibleCard id="player-vote" icon="🗳" title="Player Vote" defaultOpen={false}>
            <PlayerVote />
          </CollapsibleCard>
          <CollapsibleCard id="dj-effects" icon="🪩" title="DJ Effects" defaultOpen={false}>
            <DJEffects />
          </CollapsibleCard>
        </aside>

        {/* Drag handle */}
        <div
          onMouseDown={onSplitterDown}
          title="Drag to resize"
          style={{
            width: 6, flexShrink: 0,
            background: dragging ? "var(--color-purple)" : "var(--color-border)",
            cursor: "col-resize",
            transition: dragging ? "none" : "background 0.15s",
            position: "relative",
          }}
        >
          {/* Visible grip dots */}
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            display: "flex", flexDirection: "column", gap: 2,
            pointerEvents: "none",
          }}>
            {[0, 1, 2, 3].map(i => (
              <div key={i} style={{
                width: 2, height: 2, borderRadius: "50%",
                background: dragging ? "#fff" : "var(--color-text-muted)",
              }} />
            ))}
          </div>
        </div>

        {/* Right — live preview */}
        <div style={{ flex: 1, position: "relative", background: "var(--color-bg)", overflow: "hidden" }}>
          <LivePreview />
        </div>
      </div>
    </div>
  );
}
