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

// Tier color hint — matches the in-game rarity tag styles loosely.
function rarityColor(r: string): string {
  switch (r) {
    case "Common":       return "#9aa3ad";
    case "Rare":         return "#4db8db";
    case "Legendary":    return "#ff9500";
    case "Brainrot God": return "#2ecc71";
    case "Secret":       return "#8b4513";
    case "OG":           return "#ffd700";
    case "Prestige":     return "#a259ff";
    case "Mythic":       return "#ffd700";
    case "Limited":      return "#ff4d4d";
    default:             return "var(--color-text-muted)";
  }
}

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
  // Searchable ingredient picker — open=showing the dropdown, query=text filter
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pickerQuery, setPickerQuery] = useState("");

  // Available skins for the picker = all minus the ones already in the recipe.
  // Filter by name or rarity match. Cap visible to 30 so a future 100+ catalog
  // doesn't tank the dropdown — user can refine the search.
  const availableSkins = ALL_SKINS.filter(s => {
    if ((recipe[s.id] || 0) > 0) return false; // hide already-added
    const q = pickerQuery.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.rarity.toLowerCase().includes(q);
  }).slice(0, 30);

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
    const creds = await ensureAdminPlayerCreds();
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
    const creds = await ensureAdminPlayerCreds(); if (!creds) return;
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
    const creds = await ensureAdminPlayerCreds(); if (!creds) return;
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
        {/* Selected ingredients — only the skins actually in the recipe show here. */}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {Object.entries(recipe).filter(([, qty]) => qty > 0).length === 0 && (
            <div style={{ fontSize: 11, color: "var(--color-text-muted)", padding: "8px 0", fontStyle: "italic" }}>
              No ingredients selected yet.
            </div>
          )}
          {Object.entries(recipe).filter(([, qty]) => qty > 0).map(([sidStr, qty]) => {
            const sid = parseInt(sidStr);
            const s = ALL_SKINS.find(x => x.id === sid);
            if (!s) return null;
            return (
              <div key={"sel" + sid} style={{
                display: "flex", alignItems: "center", gap: 8,
                padding: "8px 10px", borderRadius: 6,
                background: "var(--color-card)",
                border: "1px solid var(--color-border)",
                borderLeft: `3px solid ${rarityColor(s.rarity)}`,
              }}>
                <span style={{ flex: 1, fontSize: 12, color: "#fff" }}>{s.name}</span>
                <span style={{
                  fontSize: 10, color: rarityColor(s.rarity),
                  fontFamily: "var(--font-jetbrains)",
                  padding: "2px 6px", borderRadius: 4,
                  background: `${rarityColor(s.rarity)}1a`,
                }}>{s.rarity}</span>
                <Input type="number" min="1" max="99" style={{ width: 60 }}
                  value={qty}
                  onChange={e => setRecipe(r => ({ ...r, [sid]: Math.max(1, parseInt(e.target.value) || 1) }))}
                />
                <button
                  onClick={() => setRecipe(r => { const n = { ...r }; delete n[sid]; return n; })}
                  title="Remove from recipe"
                  style={{
                    width: 24, height: 24, border: "1px solid var(--color-border)",
                    background: "var(--color-bg)", color: "var(--color-text-muted)",
                    borderRadius: 4, cursor: "pointer", fontSize: 14, lineHeight: 1,
                  }}
                >×</button>
              </div>
            );
          })}
        </div>

        {/* Add ingredient — toggle a search-filtered picker. Scales to any catalog size. */}
        <div style={{ position: "relative" }}>
          <Button
            variant="ghost"
            onClick={() => { setPickerOpen(o => !o); setPickerQuery(""); }}
            style={{ width: "100%" }}
          >
            {pickerOpen ? "Close picker" : "+ Add ingredient"}
          </Button>
          {pickerOpen && (
            <div style={{
              marginTop: 6, padding: 6,
              border: "1px solid var(--color-border)",
              borderRadius: 8, background: "var(--color-bg)",
            }}>
              <Input
                autoFocus
                placeholder="Search skin name or rarity (e.g. 'mythic', 'rare', 'pucks')"
                value={pickerQuery}
                onChange={e => setPickerQuery(e.target.value)}
                style={{ width: "100%", marginBottom: 6 }}
              />
              {availableSkins.length === 0 && (
                <div style={{ fontSize: 11, color: "var(--color-text-muted)", padding: "6px 8px" }}>
                  {ALL_SKINS.every(s => (recipe[s.id] || 0) > 0)
                    ? "All skins are already in the recipe."
                    : "No matches — try another search term."}
                </div>
              )}
              <div style={{ display: "flex", flexDirection: "column", gap: 2, maxHeight: 360, overflowY: "auto" }}>
                {availableSkins.map(s => (
                  <button
                    key={"pk" + s.id}
                    onClick={() => {
                      setRecipe(r => ({ ...r, [s.id]: 1 }));
                      setPickerQuery("");
                      setPickerOpen(false);
                    }}
                    style={{
                      display: "flex", alignItems: "center", gap: 8,
                      width: "100%", padding: "8px 10px",
                      borderRadius: 6, border: "1px solid transparent",
                      background: "transparent", color: "#fff",
                      cursor: "pointer", textAlign: "left", fontSize: 12,
                      fontFamily: "inherit",
                    }}
                    onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = "var(--color-card)"; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "transparent"; }}
                  >
                    <span style={{ flex: 1 }}>{s.name}</span>
                    <span style={{
                      fontSize: 10, color: rarityColor(s.rarity),
                      fontFamily: "var(--font-jetbrains)",
                      padding: "2px 6px", borderRadius: 4,
                      background: `${rarityColor(s.rarity)}1a`,
                    }}>{s.rarity}</span>
                  </button>
                ))}
              </div>
              {ALL_SKINS.length > 30 && availableSkins.length === 30 && (
                <div style={{ fontSize: 10, color: "var(--color-text-muted)", padding: "4px 8px", textAlign: "center" }}>
                  Showing first 30 — refine search for more.
                </div>
              )}
            </div>
          )}
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
