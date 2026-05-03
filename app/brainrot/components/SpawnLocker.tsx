"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Card, Input, Button, SectionLabel } from "./Card";
import { ensureAdminPlayerCreds, clearAdminPlayerCreds } from "@/lib/adminPlayerAuth";

// Mirror of game-side CHARACTERS — kept in sync manually.
//
// FUSION RULES (clarifying the UI):
//   • RECIPE (inputs): any 2 or 3 skins. No tier restriction. Admin can
//     ask for Common + Common → Limited, or Mythic + Limited → Limited,
//     etc. Whatever makes design sense.
//   • OUTPUT: must be a fusion-tier skin (Limited or Mythic). Those tiers
//     are FUSION-ONLY — players can't drop them, can't unlock from points,
//     can't get from ascend. Fusion is the ONLY way. So the output picker
//     only shows Limited + Mythic skins.
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
  { id: 20, name: "Stick Stick",          rarity: "Secret"       },
  { id: 21, name: "No My Pucks",          rarity: "Secret"       },
  { id: 22, name: "Hockey Bros",          rarity: "Limited"      },
  { id: 23, name: "Sushiro & Soyaro",     rarity: "Prestige"     },
  { id: 24, name: "Kingurini Orangini",   rarity: "Prestige"     },
  { id: 25, name: "Auraberry",            rarity: "Prestige"     },
  { id: 26, name: "Cupideini Hockini",    rarity: "Mythic"       },
  { id: 27, name: "Los Hockeys",          rarity: "Limited"      },
];

// Output dropdown: Limited and Mythic only (fusion-only tiers).
const FUSION_OUTPUT_TIERS = new Set(["Limited", "Mythic"]);
const OUTPUT_SKINS = ALL_SKINS.filter(s => FUSION_OUTPUT_TIERS.has(s.rarity));

interface Locker {
  id: string;
  name: string;
  recipe: { skin_id: number; qty: number }[];
  output_skin_id: number;
  total_stock: number;
  remaining_stock: number;
  status: string;
  admin_only: boolean;
  expires_at: string | null;
}

export default function SpawnLocker() {
  const [active, setActive] = useState<Locker[]>([]);
  const [name, setName] = useState("Hockey Locker");
  // Recipe: map of skin_id → qty (0 means not in recipe)
  const [recipe, setRecipe] = useState<Record<number, number>>({ 20: 1, 21: 1 });
  const [outputSkinId, setOutputSkinId] = useState<number>(22);
  const [totalStock, setTotalStock] = useState(25);
  const [duration, setDuration] = useState(2);
  const [adminOnly, setAdminOnly] = useState(true);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function refresh() {
    const { data } = await supabase
      .from("lockers")
      .select("*")
      .in("status", ["active", "sold_out"])
      .order("starts_at", { ascending: false });
    if (data) setActive(data as Locker[]);
  }

  useEffect(() => {
    refresh();
    const sub = supabase.channel("admin-lockers")
      .on("postgres_changes", { event: "*", schema: "public", table: "lockers" }, refresh)
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  async function spawn() {
    setMsg("");
    const creds = ensureAdminPlayerCreds();
    if (!creds) { setMsg("Need admin credentials."); return; }
    const recipeArr = Object.entries(recipe)
      .map(([sid, qty]) => ({ skin_id: parseInt(sid), qty }))
      .filter(r => r.qty > 0);
    if (recipeArr.length === 0) { setMsg("Add at least one ingredient."); return; }
    if (recipeArr.some(r => r.skin_id === outputSkinId)) {
      setMsg("Output can't be one of the ingredients.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.rpc("locker_spawn", {
      p_admin_username: creds.username,
      p_admin_pin: creds.pin,
      p_name: name,
      p_recipe: recipeArr,
      p_output_skin_id: outputSkinId,
      p_total_stock: totalStock,
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

  async function takeOffline(id: string) {
    const creds = ensureAdminPlayerCreds(); if (!creds) return;
    const { error } = await supabase.rpc("locker_take_offline", {
      p_admin_username: creds.username, p_admin_pin: creds.pin, p_locker_id: id,
    });
    if (error) {
      setMsg("Error taking offline: " + error.message);
      if (/unauthorized|forbidden/i.test(error.message)) clearAdminPlayerCreds();
    } else {
      setMsg("✓ Taken offline");
      setTimeout(() => setMsg(""), 3000);
    }
  }

  async function makePublic(id: string) {
    const creds = ensureAdminPlayerCreds(); if (!creds) return;
    const { error } = await supabase.rpc("locker_make_public", {
      p_admin_username: creds.username, p_admin_pin: creds.pin, p_locker_id: id,
    });
    if (error) {
      setMsg("Error making public: " + error.message);
      if (/unauthorized|forbidden/i.test(error.message)) clearAdminPlayerCreds();
    } else {
      setMsg("✓ Now public");
      setTimeout(() => setMsg(""), 3000);
    }
  }

  return (
    <Card accent="rgba(255,215,0,0.4)">
      <SectionLabel>🏒 Locker (V2 fusion)</SectionLabel>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <Input placeholder="Locker name" value={name} onChange={e => setName(e.target.value)} />

        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 6 }}>
          <strong style={{ color: "#fff" }}>Recipe ingredients</strong> · pick any 2–3 skins · qty per skin
        </div>
        <div style={{ border: "1px solid var(--color-border)", borderRadius: 6, padding: 6 }}>
          {ALL_SKINS.map(s => (
            <div key={"r" + s.id} style={{ display: "flex", alignItems: "center", gap: 8, padding: "2px 0" }}>
              <span style={{ flex: 1, fontSize: 12, color: "#fff", display: "flex", justifyContent: "space-between", gap: 8 }}>
                <span>{s.name}</span>
                <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-jetbrains)" }}>{s.rarity}</span>
              </span>
              <Input type="number" min="0" max="99" style={{ width: 60 }}
                value={recipe[s.id] ?? 0}
                onChange={e => setRecipe(r => ({ ...r, [s.id]: Math.max(0, parseInt(e.target.value) || 0) }))}
              />
            </div>
          ))}
        </div>

        <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginTop: 8 }}>
          <strong style={{ color: "#fff" }}>Output skin</strong> · only Limited + Mythic (fusion-only tiers)
        </div>
        <select
          value={outputSkinId}
          onChange={e => setOutputSkinId(parseInt(e.target.value))}
          style={{
            padding: "8px 10px", borderRadius: 8,
            background: "var(--color-bg)", border: "1px solid var(--color-border)",
            color: "#fff", fontSize: 13,
          }}
        >
          {OUTPUT_SKINS.map(s => <option key={"o" + s.id} value={s.id}>{s.name} · {s.rarity}</option>)}
        </select>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
          <div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 2 }}>Total stock</div>
            <Input type="number" min="1" max="9999" value={totalStock}
              onChange={e => setTotalStock(parseInt(e.target.value) || 25)} />
          </div>
          <div>
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", marginBottom: 2 }}>Duration (hours)</div>
            <Input type="number" min="1" max="48" value={duration}
              onChange={e => setDuration(parseInt(e.target.value) || 2)} />
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#fff", cursor: "pointer" }}>
          <input type="checkbox" checked={adminOnly} onChange={e => setAdminOnly(e.target.checked)} />
          Dry-run (only admin players see the locker)
        </label>

        <Button variant="success" onClick={spawn} disabled={busy}>
          {busy ? "Spawning..." : "Spawn Locker"}
        </Button>

        {msg && <div style={{ fontSize: 12, color: msg.startsWith("✓") ? "var(--color-green)" : "var(--color-red)" }}>{msg}</div>}
      </div>

      {active.length > 0 && (
        <div style={{ marginTop: 16, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
          <SectionLabel>Active</SectionLabel>
          {active.map(lk => {
            const output = ALL_SKINS.find(s => s.id === lk.output_skin_id);
            return (
              <div key={lk.id} style={{
                background: "var(--color-bg)", border: "1px solid var(--color-border)",
                borderRadius: 8, padding: 10, marginBottom: 8, fontSize: 12, color: "#fff",
              }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <strong>{lk.name}</strong>
                  <span style={{ color: lk.admin_only ? "#ff8c00" : "#2ecc71", fontSize: 10 }}>
                    {lk.admin_only ? "DRY-RUN" : "PUBLIC"}
                  </span>
                </div>
                <div style={{ fontSize: 11, opacity: 0.8, marginBottom: 6 }}>
                  Output: {output?.name || `#${lk.output_skin_id}`} · Stock: {lk.remaining_stock}/{lk.total_stock} · Status: {lk.status}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {lk.admin_only && lk.status === "active" && (
                    <Button variant="success" onClick={() => makePublic(lk.id)}
                      style={{ fontSize: 10, padding: "4px 8px" }}>Make Public</Button>
                  )}
                  {lk.status === "active" && (
                    <Button variant="danger" onClick={() => takeOffline(lk.id)}
                      style={{ fontSize: 10, padding: "4px 8px" }}>Take Offline</Button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}
