"use client";

import { useEffect, useState } from "react";
import { supabase, GAME_ID, EFFECTS } from "@/lib/supabase";
import { Card, SectionLabel } from "./Card";

// DJ Effects are now always available — the game side renders effects
// purely off the active_effects table, with no admin_events.active gate,
// so admins can spin live whenever (e.g. Friday night session, gameday
// hype, or just for fun). Previously locked behind a live event.
export default function DJEffects() {
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

  // Toggle reads the DB row at click time (not React state) so it stays
  // correct even if local state is stale from a missed realtime event. Errors
  // were previously swallowed — that masked silent RLS failures, which left
  // admin showing OFF while the real row stayed ON and the player kept
  // hearing music. Now we surface the error and skip the local update if the
  // DB write doesn't land.
  const toggle = async (effectId: string) => {
    const { data: existing, error: selectError } = await supabase.from("active_effects")
      .select("id, active").eq("game_id", GAME_ID).eq("effect_id", effectId).maybeSingle();
    if (selectError) {
      window.alert(`Couldn't read ${effectId} state: ${selectError.message}`);
      return;
    }
    const currentActive = !!existing?.active;
    const newActive = !currentActive;

    if (existing) {
      const { error } = await supabase.from("active_effects")
        .update({ active: newActive, started_at: new Date().toISOString() })
        .eq("id", existing.id);
      if (error) {
        window.alert(`Couldn't toggle ${effectId}: ${error.message}`);
        return;
      }
    } else {
      const { error } = await supabase.from("active_effects").insert({
        game_id: GAME_ID, effect_id: effectId, active: newActive,
      });
      if (error) {
        window.alert(`Couldn't create ${effectId}: ${error.message}`);
        return;
      }
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

  // Defensive nuke — flips every effect off in one shot. Useful when the UI
  // gets desynced from the DB (e.g. realtime channel dropped) and the admin
  // just wants the floor cleared.
  const stopAll = async () => {
    const { error } = await supabase.from("active_effects")
      .update({ active: false }).eq("game_id", GAME_ID);
    if (error) { window.alert(`Couldn't stop all: ${error.message}`); return; }
    setActive({});
  };

  const anyActive = Object.values(active).some(Boolean);

  return (
    <Card>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <SectionLabel>DJ effects</SectionLabel>
        {anyActive && (
          <button onClick={stopAll} title="Force every effect off (safety net if the UI desyncs from the DB)" style={{
            padding: "3px 8px", borderRadius: 6, fontSize: 10,
            background: "transparent", color: "var(--color-text-muted)",
            border: "1px solid var(--color-border)", cursor: "pointer",
          }}>Stop all</button>
        )}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
        {EFFECTS.map(fx => {
          const on = active[fx.id];
          return (
            <button key={fx.id} onClick={() => toggle(fx.id)}
              style={{
                padding: "8px 10px", borderRadius: 8,
                background: on ? `${fx.color}22` : "var(--color-bg)",
                border: `1px solid ${on ? fx.color : "var(--color-border)"}`,
                color: "#fff", display: "flex", alignItems: "center", gap: 6,
                cursor: "pointer",
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
