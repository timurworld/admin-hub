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
import BotTools from "./components/BotTools";
import { useAdminTier } from "@/lib/useAdminTier";
import { useSessionRole } from "@/lib/useSessionRole";
import { getAdminPlayerCreds, setAdminPlayerCreds } from "@/lib/adminPlayerAuth";

const SPLIT_KEY = "brainrot_admin_split_px";
const MIN_LEFT = 320;
const MAX_LEFT = 1100;

// Section: each functional area renders as a distinct PANEL — colored
// top stripe, dark glassy header with glowing icon, lighter body holding
// the cards. This breaks up what used to be one continuous wall of cards
// into clearly-bounded zones the eye can lock onto during live ops.
function Section({ id, icon, accent, title, children }: {
  id?: string; icon?: string; accent?: string;
  title: React.ReactNode; children: React.ReactNode;
}) {
  const a = accent || "var(--color-purple)";
  return (
    <div style={{
      marginTop: 28,
      borderRadius: 12,
      background: "rgba(255,255,255,0.035)",                 // grey body tint
      border: `1px solid ${a}40`,                            // colored ring
      borderTop: `4px solid ${a}`,                           // bold top stripe
      boxShadow: `0 6px 24px ${a}14, 0 0 0 1px rgba(0,0,0,0.4) inset`,
      // No overflow:hidden — when a card inside is OPEN its body is tall,
      // and clipping it makes the tools inaccessible. Cards render at full
      // natural height; the aside scrolls if the column gets long.
      flexShrink: 0,
    }}>
      {/* Header bar — black-ish glassy strip with glowing icon + bold label */}
      <div id={id} style={{
        display: "flex", alignItems: "center", gap: 12,
        padding: "14px 16px",
        background: `linear-gradient(180deg, ${a}1c 0%, rgba(0,0,0,0.45) 100%)`,
        borderBottom: `1px solid ${a}33`,
      }}>
        {icon && <span style={{
          fontSize: 22, lineHeight: 1,
          filter: `drop-shadow(0 0 10px ${a})`,
        }}>{icon}</span>}
        <span style={{
          fontSize: 13, fontWeight: 800, color: "#fff",
          letterSpacing: "0.18em", textTransform: "uppercase",
          textShadow: `0 0 14px ${a}88`,
        }}>{title}</span>
      </div>
      {/* Body — cards sit inside on the lighter grey backdrop. Generous
          all-around padding and 14px gap between cards. No height cap so
          opened cards can grow as tall as their forms need. */}
      <div style={{
        padding: "22px 18px 28px",
        display: "flex", flexDirection: "column", gap: 14,
      }}>{children}</div>
    </div>
  );
}

export default function BrainrotAdmin() {
  const [eventActive, setEventActive] = useState(false);
  const [playerCount, setPlayerCount] = useState(0);
  const online = usePresence();
  // In-game tier (display only — for the badge inside the Switch User button).
  const { tier, isGodAdmin } = useAdminTier();
  // Site session role IS the security boundary. God Admin section + Switch
  // User button render only when EmoneyAdmin is logged in. TmoneyAdmin sees
  // a static identity label and cannot escalate.
  const { role: sessionRole, isGodAdmin: isGodSession } = useSessionRole();
  const siteUsername = sessionRole === "god" ? "EmoneyAdmin" : sessionRole === "admin" ? "TmoneyAdmin" : "—";
  // Track the cached admin username so the header can show who's logged in
  // and the Switch User button can prompt for a swap.
  const [currentAdminUsername, setCurrentAdminUsername] = useState<string | null>(null);
  useEffect(() => {
    setCurrentAdminUsername(getAdminPlayerCreds()?.username ?? null);
  }, []);

  const switchAdminUser = () => {
    const next = window.prompt(
      `Switch admin (currently: ${currentAdminUsername ?? "none"}).\nEnter the new in-game username:`,
      "",
    );
    if (!next || !next.trim()) return;
    const pin = window.prompt(`PIN for ${next.trim()}:`);
    if (!pin || !pin.trim()) return;
    setAdminPlayerCreds({ username: next.trim(), pin: pin.trim() });
    window.location.reload();
  };

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
          {/* Switch admin user — only visible to EmoneyAdmin sessions.
              TmoneyAdmin gets a static identity badge instead, so they can't
              swap into emoney's PIN to escalate. The in-game tier badge in
              the button is informational; the security check is on sessionRole. */}
          {isGodSession ? (
            <button onClick={switchAdminUser} title="Switch the in-game admin user (changes which tools are visible)" style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 10px", borderRadius: 8, background: "var(--color-card)",
              border: `1px solid ${isGodAdmin ? "rgba(255,77,77,0.5)" : "var(--color-border)"}`,
              color: "#fff", cursor: "pointer", fontSize: 12,
            }}>
              <span style={{ fontSize: 13 }}>{isGodAdmin ? "👑" : tier >= 1 ? "🛡️" : "👤"}</span>
              <span className="font-mono">{currentAdminUsername || "not set"}</span>
              <span style={{ fontSize: 10, color: "var(--color-text-muted)" }}>(tier {tier})</span>
              <span style={{ fontSize: 10, color: "var(--color-text-muted)", marginLeft: 4 }}>switch</span>
            </button>
          ) : (
            <span className="font-mono" style={{
              display: "flex", alignItems: "center", gap: 6,
              padding: "6px 10px", borderRadius: 8,
              background: "var(--color-card)", border: "1px solid var(--color-border)",
              color: "#fff", fontSize: 12,
            }}>
              <span style={{ fontSize: 13 }}>🛡️</span>
              {siteUsername}
            </span>
          )}
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

          {/* 1. LIVE SHOW — admin abuse toggle + scheduling. Show on/off only. */}
          <Section id="section-live" icon="🎬" accent="#ff4d4d" title="Live Show">
            <CollapsibleCard id="live-event" icon="🔴" title="Live Event" defaultOpen accent="var(--color-red)">
              <LiveEventBlock onChange={setEventActive} />
            </CollapsibleCard>
            <CollapsibleCard id="scheduler" icon="📅" title="Schedule Event" defaultOpen={false}>
              <EventScheduler />
            </CollapsibleCard>
          </Section>

          {/* 2. BROADCASTS & VOTES — push content to all players. Both
              broadcasts and player votes share the "fan out to everyone"
              shape, so they belong together. */}
          <Section id="section-broadcast" icon="📣" accent="#ffa630" title="Broadcasts & Votes">
            <CollapsibleCard id="global-message" icon="📢" title="Broadcast Message" defaultOpen={false} forceOpen={eventActive}>
              <GlobalMessage />
            </CollapsibleCard>
            <CollapsibleCard id="player-vote" icon="🗳" title="Player Vote" defaultOpen={false}>
              <PlayerVote />
            </CollapsibleCard>
          </Section>

          {/* 3. PLAYER REWARDS — per-player gifts, always available. */}
          <Section id="section-rewards" icon="🎁" accent="#ffd700" title="Player Rewards">
            <CollapsibleCard id="give-coins" icon="🪙" title="Give Coins" defaultOpen={false}>
              <GiveCoins />
            </CollapsibleCard>
            <CollapsibleCard id="give-skin" icon="🎁" title="Give Skin" defaultOpen={false}>
              <GiveSkin />
            </CollapsibleCard>
          </Section>

          {/* 4. DROPS & LOCKERS — long-running content events, decoupled from live show. */}
          <Section id="section-events" icon="⚡" accent="#a259ff" title="Drops & Lockers">
            <CollapsibleCard id="drop-event" icon="🎁" title="Drop Event" defaultOpen={false} accent="rgba(255,200,80,0.5)">
              <SpawnDropEvent />
            </CollapsibleCard>
            <CollapsibleCard id="locker" icon="🔐" title="Locker" defaultOpen={false} accent="#ffd700">
              <SpawnLocker />
            </CollapsibleCard>
          </Section>

          {/* 5. DJ BOOTH — visual flair tools used during a live show. */}
          <Section id="section-djbooth" icon="🎵" accent="#00d4ff" title="DJ Booth">
            <CollapsibleCard id="dj-effects" icon="🪩" title="DJ Effects" defaultOpen={false}>
              <DJEffects />
            </CollapsibleCard>
          </Section>

          {/* 6. GOD ADMIN — gated on the SITE SESSION being EmoneyAdmin, not
              the in-game admin_tier. This makes the dashboard an honest gate:
              TmoneyAdmin sessions cannot reveal these tools by switching the
              cached in-game PIN. Server-side RPCs still verify admin_tier as
              defense-in-depth. */}
          {isGodSession && (
            <Section id="section-godadmin" icon="👑" accent="#ff4d4d" title="God Admin">
              <CollapsibleCard id="bot-tools" icon="🤖" title="Bot Tools" defaultOpen={false}>
                <BotTools />
              </CollapsibleCard>
            </Section>
          )}
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
