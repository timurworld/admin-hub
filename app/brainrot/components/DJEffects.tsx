"use client";

import { useEffect, useState } from "react";
import { supabase, GAME_ID, EFFECTS } from "@/lib/supabase";
import { Card, SectionLabel } from "./Card";

export default function DJEffects({ locked }: { locked: boolean }) {
  const [active, setActive] = useState<Record<string, boolean>>({});

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from("active_effects").select("effect_id, active").eq("game_id", GAME_ID);
      if (data) {
        const map: Record<string, boolean> = {};
        data.forEach((r: { effect_id: string; active: boolean }) => { map[r.effect_id] = r.active; });
        setActive(map);
      }
    }
    fetch();

    const sub = supabase.channel("effects")
      .on("postgres_changes", { event: "*", schema: "public", table: "active_effects" }, (payload) => {
        const row = payload.new as { effect_id?: string; active?: boolean };
        if (row?.effect_id) {
          setActive(prev => ({ ...prev, [row.effect_id!]: !!row.active }));
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  const toggle = async (effectId: string) => {
    if (locked) return;
    const newActive = !active[effectId];
    const { data: existing } = await supabase.from("active_effects")
      .select("id").eq("game_id", GAME_ID).eq("effect_id", effectId).maybeSingle();
    if (existing) {
      await supabase.from("active_effects").update({ active: newActive, started_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase.from("active_effects").insert({
        game_id: GAME_ID, effect_id: effectId, active: newActive,
      });
    }
    setActive(prev => ({ ...prev, [effectId]: newActive }));

    // Auto-stop for timed effects
    if (newActive && (effectId === "rocket" || effectId === "bomb")) {
      setTimeout(async () => {
        await supabase.from("active_effects").update({ active: false })
          .eq("game_id", GAME_ID).eq("effect_id", effectId);
        setActive(prev => ({ ...prev, [effectId]: false }));
      }, 3000);
    }
  };

  return (
    <Card style={locked ? { opacity: 0.4 } : undefined}>
      <SectionLabel>DJ effects</SectionLabel>
      {locked && (
        <div style={{
          fontSize: 11, color: "var(--color-text-muted)", textAlign: "center",
          marginBottom: 8, padding: 8, background: "var(--color-bg)", borderRadius: 6,
        }}>⬆ Start live event to unlock</div>
      )}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {EFFECTS.map(fx => {
          const on = active[fx.id];
          return (
            <button key={fx.id} onClick={() => toggle(fx.id)} disabled={locked}
              style={{
                padding: "8px 10px", borderRadius: 8,
                background: on ? `${fx.color}22` : "var(--color-bg)",
                border: `1px solid ${on ? fx.color : "var(--color-border)"}`,
                color: "#fff", display: "flex", alignItems: "center", gap: 6,
                cursor: locked ? "not-allowed" : "pointer",
                transition: "all 0.15s", fontSize: 11,
              }}>
              <span style={{ fontSize: 16 }}>{fx.emoji}</span>
              <span style={{ flex: 1, textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{fx.name}</span>
              <span style={{ color: on ? fx.color : "var(--color-text-muted)", fontSize: 12, fontWeight: 700 }}>
                {on ? "■" : "▶"}
              </span>
            </button>
          );
        })}
      </div>
    </Card>
  );
}
