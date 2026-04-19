"use client";

import { useEffect, useState } from "react";
import { supabase, GAME_ID } from "@/lib/supabase";
import { Card, SectionLabel, Button } from "./Card";

export default function LiveEventBlock({ onChange }: { onChange: (active: boolean) => void }) {
  const [active, setActive] = useState(false);
  const [startedAt, setStartedAt] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState("00:00");

  useEffect(() => {
    async function fetchState() {
      const { data } = await supabase.from("admin_events").select("active, started_at").eq("game_id", GAME_ID).single();
      if (data) {
        setActive(data.active);
        setStartedAt(data.started_at);
        onChange(data.active);
      }
    }
    fetchState();

    const sub = supabase.channel("admin-events-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_events" }, (payload) => {
        const row = payload.new as { active?: boolean; started_at?: string };
        if (row?.active !== undefined) {
          setActive(row.active);
          setStartedAt(row.started_at || null);
          onChange(row.active);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, [onChange]);

  useEffect(() => {
    if (!active || !startedAt) return;
    const interval = setInterval(() => {
      const ms = Date.now() - new Date(startedAt).getTime();
      const s = Math.floor(ms / 1000);
      const mm = String(Math.floor(s / 60)).padStart(2, "0");
      const ss = String(s % 60).padStart(2, "0");
      setElapsed(`${mm}:${ss}`);
    }, 500);
    return () => clearInterval(interval);
  }, [active, startedAt]);

  const start = async () => {
    await supabase.from("admin_events").update({
      active: true, started_at: new Date().toISOString(),
    }).eq("game_id", GAME_ID);
  };

  const stop = async () => {
    await supabase.from("admin_events").update({ active: false }).eq("game_id", GAME_ID);
    // Clear active effects
    await supabase.from("active_effects").update({ active: false }).eq("game_id", GAME_ID);
  };

  return (
    <Card
      accent={active ? "rgba(255,74,74,0.5)" : undefined}
      style={active ? { boxShadow: "0 0 30px rgba(255,74,74,0.2)" } : undefined}
    >
      <SectionLabel>Admin Abuse</SectionLabel>
      {active ? (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <span className="pulse-dot" style={{ width: 10, height: 10, borderRadius: "50%", background: "var(--color-red)" }} />
            <span className="font-heading btn-upper" style={{ fontSize: 13, color: "var(--color-red)" }}>🔴 Live</span>
          </div>
          <div className="font-mono" style={{ fontSize: 24, color: "#fff", marginBottom: 12 }}>{elapsed}</div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button disabled variant="disabled" style={{ flex: 1 }}>Running…</Button>
            <Button onClick={stop} variant="danger" style={{ flex: 1 }}>■ Stop</Button>
          </div>
        </>
      ) : (
        <>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-text-muted)" }} />
            <span style={{ fontSize: 13, color: "var(--color-text)" }}>No Admin Abuse running</span>
          </div>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 12 }}>
            Start or schedule below
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Button onClick={start} variant="success" style={{ flex: 1 }}>▶ Start</Button>
            <Button disabled variant="disabled" style={{ flex: 1 }}>■ Stop</Button>
          </div>
        </>
      )}
    </Card>
  );
}
