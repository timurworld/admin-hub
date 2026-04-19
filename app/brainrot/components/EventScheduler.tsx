"use client";

import { useEffect, useState } from "react";
import { supabase, GAME_ID } from "@/lib/supabase";
import { Card, SectionLabel, Input, Button } from "./Card";

export default function EventScheduler() {
  const [name, setName] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [scheduled, setScheduled] = useState<{ id: string; event_name: string; scheduled_for: string } | null>(null);
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    async function fetchScheduled() {
      const { data } = await supabase.from("scheduled_events")
        .select("*").eq("game_id", GAME_ID)
        .gt("scheduled_for", new Date().toISOString())
        .order("scheduled_for", { ascending: true })
        .limit(1).maybeSingle();
      if (data) setScheduled(data);
    }
    fetchScheduled();
  }, []);

  useEffect(() => {
    if (!scheduled) return;
    const interval = setInterval(async () => {
      const diff = new Date(scheduled.scheduled_for).getTime() - Date.now();
      if (diff <= 0) {
        await supabase.from("admin_events").update({
          active: true, started_at: new Date().toISOString(), event_name: scheduled.event_name,
        }).eq("game_id", GAME_ID);
        await supabase.from("scheduled_events").delete().eq("id", scheduled.id);
        setScheduled(null);
        return;
      }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${d}d ${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`);
    }, 1000);
    return () => clearInterval(interval);
  }, [scheduled]);

  const schedule = async () => {
    if (!name || !date || !time) return;
    const scheduledFor = new Date(`${date}T${time}`).toISOString();
    const { data } = await supabase.from("scheduled_events")
      .insert({ game_id: GAME_ID, event_name: name, scheduled_for: scheduledFor })
      .select().single();
    if (data) {
      setScheduled(data);
      setName(""); setDate(""); setTime("");
    }
  };

  const cancel = async () => {
    if (scheduled) {
      await supabase.from("scheduled_events").delete().eq("id", scheduled.id);
      setScheduled(null);
    }
  };

  return (
    <Card>
      <SectionLabel>Schedule admin abuse event</SectionLabel>
      {scheduled ? (
        <>
          <div style={{ fontSize: 13, color: "#fff", marginBottom: 4 }}>{scheduled.event_name}</div>
          <div style={{
            display: "inline-block", padding: "6px 12px", borderRadius: 999,
            background: "rgba(162,89,255,0.15)", border: "1px solid rgba(162,89,255,0.4)",
            marginBottom: 12,
          }}>
            <span className="font-mono" style={{ fontSize: 12, color: "var(--color-purple)" }}>⚡ {countdown}</span>
          </div>
          <Button variant="ghost" onClick={cancel} style={{ width: "100%" }}>✕ Cancel</Button>
        </>
      ) : (
        <>
          <Input placeholder="Brainrot Chaos Night 🔥" value={name} onChange={e => setName(e.target.value)} style={{ marginBottom: 8 }} />
          <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
            <Input type="date" value={date} onChange={e => setDate(e.target.value)} style={{ flex: 1 }} />
            <Input type="time" value={time} onChange={e => setTime(e.target.value)} style={{ flex: 1 }} />
          </div>
          <Button variant="primary" onClick={schedule} disabled={!name || !date || !time} style={{ width: "100%" }}>📅 Schedule</Button>
        </>
      )}
    </Card>
  );
}
