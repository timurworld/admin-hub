"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, Input, Button, SectionLabel } from "./Card";
import { ensureAdminPlayerCreds, clearAdminPlayerCreds } from "@/lib/adminPlayerAuth";

// Skin catalog mirrors src/App.jsx CHARACTERS — kept in sync manually for now.
//
// GATING POLICY: only Limited skins are gated. Everything else (Common
// through Mythic, including Prestige) can go in a drop pool.
//   • Excluded: Hockey Bros (#22) + Los Hockeys (#27) — Limited stays
//     exclusive to fusion lockers so they keep scarcity.
//   • Included: Cupideini Hockini (#26, Mythic) — admin can run a "drop
//     the Maple Cup" event if they want.
//
// Each entry shows rarity in the label so admins know what tier they're
// putting in the pool.
const ALL_SKINS = [
  { id: 1,  name: "Noobini Lovini",       rarity: "Common"       },
  { id: 2,  name: "Romantini Grandini",   rarity: "Common"       },
  { id: 3,  name: "Lovini Lovini Lovini", rarity: "Brainrot God" },
  { id: 4,  name: "Teddini & Robotini",   rarity: "Legendary"    },
  { id: 5,  name: "Noobini Partini",      rarity: "Brainrot God" },
  { id: 6,  name: "Cakini Presintini",    rarity: "Secret"       },
  { id: 7,  name: "Lovini Rosetti",       rarity: "Rare"         },
  { id: 8,  name: "Heartini Smilekurro",  rarity: "Common"       },
  { id: 9,  name: "Dragini Partini",      rarity: "OG"           },
  { id: 10, name: "Cupidini Sahuroni",    rarity: "Legendary"    },
  { id: 11, name: "Rositti Tueletti",     rarity: "Rare"         },
  { id: 12, name: "Birthdayini Cardini",  rarity: "Brainrot God" },
  { id: 13, name: "Cakini Elephantini",   rarity: "OG"           },
  { id: 15, name: "Pizzini Partyini",     rarity: "Brainrot God" },
  { id: 18, name: "Noo Mio Heartini",     rarity: "Rare"         },
  { id: 19, name: "Cupidini Hotspottini", rarity: "Legendary"    },
  { id: 20, name: "Stick Stick",          rarity: "Secret",      tag: "Sportini" },
  { id: 21, name: "No My Pucks",          rarity: "Secret",      tag: "Sportini" },
  // 22 Hockey Bros — Limited, gated.
  { id: 23, name: "Sushiro & Soyaro",     rarity: "Prestige"     },
  { id: 24, name: "Kingurini Orangini",   rarity: "Prestige"     },
  { id: 25, name: "Auraberry",            rarity: "Prestige"     },
  { id: 26, name: "Cupideini Hockini",    rarity: "Mythic",      tag: "Sportini" },
  // 27 Los Hockeys — Limited, gated.
];

interface DropEvent {
  id: string;
  name: string;
  drop_pool: { skin_id: number; total: number; remaining: number }[];
  baseline_rate_inv: number;
  wave_multiplier: number;
  wave_duration_sec: number;
  current_wave_skin_id: number | null;
  current_wave_ends_at: string | null;
  status: string;
  admin_only: boolean;
  expires_at: string | null;
}

export default function SpawnDropEvent() {
  const [active, setActive] = useState<DropEvent[]>([]);
  const [name, setName] = useState("Sportini Storm");
  const [pool, setPool] = useState<{ [skinId: number]: number }>({ 20: 300, 21: 300 });
  const [baselineRate, setBaselineRate] = useState(500);
  const [waveMultiplier, setWaveMultiplier] = useState(10);
  const [waveDuration, setWaveDuration] = useState(60);
  const [waveFrequency, setWaveFrequency] = useState(10);
  const [duration, setDuration] = useState(2);
  const [adminOnly, setAdminOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function refresh() {
    const { data } = await supabase
      .from("drop_events")
      .select("*")
      .eq("status", "active")
      .order("starts_at", { ascending: false });
    if (data) setActive(data as DropEvent[]);
  }

  useEffect(() => {
    refresh();
    const sub = supabase.channel("admin-drop-events")
      .on("postgres_changes", { event: "*", schema: "public", table: "drop_events" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  async function spawn() {
    setMsg("");
    const creds = ensureAdminPlayerCreds();
    if (!creds) { setMsg("Need admin credentials to spawn."); return; }
    const poolEntries = Object.entries(pool)
      .map(([sid, total]) => ({ skin_id: parseInt(sid), total: total }))
      .filter(p => p.total > 0);
    if (poolEntries.length === 0) { setMsg("Pick at least one skin with stock."); return; }
    setBusy(true);
    const { error } = await supabase.rpc("drop_event_spawn", {
      p_admin_username: creds.username,
      p_admin_pin: creds.pin,
      p_name: name,
      p_pool: poolEntries,
      p_baseline_rate_inv: baselineRate,
      p_wave_frequency_min: waveFrequency,
      p_wave_duration_sec: waveDuration,
      p_wave_multiplier: waveMultiplier,
      p_duration_hours: duration,
      p_admin_only: adminOnly,
    });
    setBusy(false);
    if (error) {
      setMsg("Error: " + error.message);
      if (/unauthorized|forbidden/i.test(error.message)) clearAdminPlayerCreds();
    } else {
      setMsg(`✓ Spawned "${name}" (${adminOnly ? "DRY-RUN" : "PUBLIC"})`);
      setTimeout(() => setMsg(""), 4000);
    }
  }

  async function endEvent(id: string) {
    const creds = ensureAdminPlayerCreds(); if (!creds) return;
    const { error } = await supabase.rpc("drop_event_end", {
      p_admin_username: creds.username, p_admin_pin: creds.pin, p_event_id: id,
    });
    if (error) {
      setMsg("Error ending event: " + error.message);
      if (/unauthorized|forbidden/i.test(error.message)) clearAdminPlayerCreds();
    } else {
      setMsg("✓ Event ended");
      setTimeout(() => setMsg(""), 3000);
    }
  }

  async function makePublic(id: string) {
    const creds = ensureAdminPlayerCreds(); if (!creds) return;
    const { error } = await supabase.rpc("drop_event_make_public", {
      p_admin_username: creds.username, p_admin_pin: creds.pin, p_event_id: id,
    });
    if (error) {
      setMsg("Error making public: " + error.message);
      if (/unauthorized|forbidden/i.test(error.message)) clearAdminPlayerCreds();
    } else {
      setMsg("✓ Now public");
      setTimeout(() => setMsg(""), 3000);
    }
  }

  async function triggerWave(id: string, skinId: number) {
    const creds = ensureAdminPlayerCreds(); if (!creds) return;
    const { error } = await supabase.rpc("wave_trigger", {
      p_admin_username: creds.username, p_admin_pin: creds.pin,
      p_event_id: id, p_skin_id: skinId,
    });
    if (error) {
      setMsg("Error triggering wave: " + error.message);
      if (/unauthorized|forbidden/i.test(error.message)) clearAdminPlayerCreds();
    } else {
      setMsg("✓ Wave triggered");
      setTimeout(() => setMsg(""), 3000);
    }
  }

  return (
    <Card accent="rgba(255,200,80,0.4)">
      <SectionLabel>🎁 Drop Event (V2)</SectionLabel>

      {/* Spawn form */}
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Input placeholder="Event name" value={name} onChange={e => setName(e.target.value)} />

        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>Skins to drop (qty per skin)</div>
        {ALL_SKINS.map(s => (
          <div key={s.id} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span style={{ flex: 1, fontSize: 12, color: "#fff", display: "flex", justifyContent: "space-between", gap: 8 }}>
              <span>{s.name}</span>
              <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-jetbrains)" }}>{s.rarity}</span>
            </span>
            <Input type="number" min="0" max="9999" style={{ width: 80 }}
              value={pool[s.id] ?? 0}
              onChange={e => setPool(p => ({ ...p, [s.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
            />
          </div>
        ))}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 2 }}>Baseline rate (1 in N)</div>
            <Input type="number" min="10" value={baselineRate}
              onChange={e => setBaselineRate(parseInt(e.target.value) || 500)} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 2 }}>Duration (hours)</div>
            <Input type="number" min="1" max="24" value={duration}
              onChange={e => setDuration(parseInt(e.target.value) || 2)} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 2 }}>Wave multiplier</div>
            <Input type="number" min="2" max="100" value={waveMultiplier}
              onChange={e => setWaveMultiplier(parseInt(e.target.value) || 10)} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 2 }}>Wave duration (sec)</div>
            <Input type="number" min="10" max="600" value={waveDuration}
              onChange={e => setWaveDuration(parseInt(e.target.value) || 60)} />
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#fff", cursor: "pointer" }}>
          <input type="checkbox" checked={adminOnly} onChange={e => setAdminOnly(e.target.checked)} />
          Dry-run (admin-only — only tmoney sees the event)
        </label>

        <Button variant="success" onClick={spawn} disabled={busy}>
          {busy ? "Spawning..." : "Spawn Drop Event"}
        </Button>

        {msg && <div style={{ fontSize: 12, color: msg.startsWith("✓") ? "var(--color-green)" : "var(--color-red)" }}>{msg}</div>}
      </div>

      {/* Active events */}
      {active.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
          <SectionLabel>Active</SectionLabel>
          {active.map(ev => {
            const remaining = ev.drop_pool.reduce((a, p) => a + p.remaining, 0);
            const total = ev.drop_pool.reduce((a, p) => a + p.total, 0);
            const waveActive = ev.current_wave_ends_at && new Date(ev.current_wave_ends_at) > new Date();
            return (
              <div key={ev.id} style={{
                background: "var(--color-bg)", border: "1px solid var(--color-border)",
                borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 12, color: "#fff",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                  <strong>{ev.name}</strong>
                  <span style={{ color: ev.admin_only ? "#ff8c00" : "#2ecc71", fontSize: 10 }}>
                    {ev.admin_only ? "DRY-RUN" : "PUBLIC"}
                  </span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 6 }}>
                  Stock: {remaining}/{total}
                  {waveActive && <span style={{ color: "#ffd700", marginLeft: 8 }}>⚡ wave active</span>}
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {ev.drop_pool.filter(p => p.remaining > 0).map(p => {
                    const skin = ALL_SKINS.find(s => s.id === p.skin_id);
                    return (
                      <Button key={p.skin_id} variant="ghost"
                        onClick={() => triggerWave(ev.id, p.skin_id)}
                        style={{ fontSize: 10, padding: "4px 8px" }}>
                        ⚡ Wave: {skin?.name?.split(" ")[0] || `#${p.skin_id}`}
                      </Button>
                    );
                  })}
                  {ev.admin_only && (
                    <Button variant="success" onClick={() => makePublic(ev.id)}
                      style={{ fontSize: 10, padding: "4px 8px" }}>Make Public</Button>
                  )}
                  <Button variant="danger" onClick={() => endEvent(ev.id)}
                    style={{ fontSize: 10, padding: "4px 8px" }}>End</Button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
