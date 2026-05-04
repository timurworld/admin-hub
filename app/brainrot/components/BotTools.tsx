"use client";

// Players control — EmoneyAdmin-only spawn/stop UI for the live-player
// simulator. Visibility is gated upstream on useSessionRole().isGodAdmin so
// this component itself doesn't enforce — by the time it renders, the parent
// has already confirmed an EmoneyAdmin site session.
//
// State lives in lib/botDriver so the running roster survives a component
// remount. Each spawn brings new players online immediately (no jitter) and
// they keep running until Stop all or the admin tab closes.

import { useEffect, useState } from "react";
import { Card, SectionLabel, Button } from "./Card";
import {
  ROSTER_SIZE, getLiveCount, getLiveNames,
  subscribe, spawnBots, stopAll,
} from "@/lib/botDriver";

export default function BotTools() {
  const [liveCount, setLiveCount] = useState(0);
  const [liveNames, setLiveNames] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const refresh = () => { setLiveCount(getLiveCount()); setLiveNames(getLiveNames()); };
    refresh();
    return subscribe(refresh);
  }, []);

  const remaining = ROSTER_SIZE - liveCount;

  const onSpawn = async (n: number) => {
    setBusy(true);
    try { await spawnBots(n); } finally { setBusy(false); }
  };
  const onStop = async () => {
    setBusy(true);
    try { await stopAll(); } finally { setBusy(false); }
  };

  return (
    <Card accent="rgba(255,77,77,0.45)">
      <SectionLabel>👥 Users — Extra tools only</SectionLabel>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
          Spawn fake live players for demos. They join presence, score on the
          board, react with emotes, vote, roll for drops, and fuse lockers — a
          full live-player simulation. Players stop when you close this tab.
        </div>

        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "8px 10px", borderRadius: 6,
          background: "var(--color-card)", border: "1px solid var(--color-border)",
        }}>
          <span className="font-mono" style={{ fontSize: 12, color: "#fff" }}>
            {liveCount} <span style={{ color: "var(--color-text-muted)" }}>/ {ROSTER_SIZE} live</span>
          </span>
          {liveCount > 0 && (
            <span style={{ fontSize: 10, color: "var(--color-text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 220, marginLeft: 12 }}>
              {liveNames.slice(0, 4).join(", ")}{liveNames.length > 4 ? ` +${liveNames.length - 4}` : ""}
            </span>
          )}
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <Button variant="ghost" disabled={busy || remaining <= 0} onClick={() => onSpawn(10)}>
            + Spawn 10 players
          </Button>
          <Button variant="ghost" disabled={busy || remaining <= 0} onClick={() => onSpawn(30)}>
            + Spawn 30 players
          </Button>
          <Button variant="ghost" disabled={busy || remaining <= 0} onClick={() => onSpawn(ROSTER_SIZE)}>
            + Spawn full roster ({ROSTER_SIZE})
          </Button>
          <Button variant="ghost" disabled={busy || liveCount === 0} onClick={onStop}>
            ⏹ Stop all players
          </Button>
        </div>
      </div>
    </Card>
  );
}
