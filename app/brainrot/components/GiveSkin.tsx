"use client";

import { useEffect, useState } from "react";
import { supabase, GAME_ID } from "@/lib/supabase";
import { Card, SectionLabel, Input, Button } from "./Card";

const SKINS = [
  "Noobini Lovini","Romantini Grandini","Lovini Lovini Lovini","Teddini & Robotini",
  "Noobini Partini","Cakini Presintini","Lovini Rosetti","Heartini Smilekurro",
  "Dragini Partini","Cupidini Sahuroni","Rositti Tueletti","Birthdayini Cardini",
  "Noobini Partyini","Noo Mio Heartini","Cupidini Hotspottini",
];

interface Player { username: string; player_id: string; }

export default function GiveSkin() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [skin, setSkin] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from("leaderboard")
        .select("username, player_id")
        .order("lifetime_points", { ascending: false }).limit(9);
      if (data) setPlayers(data);
    }
    fetch();
  }, []);

  const send = async () => {
    if (!skin.trim()) return;
    const target = selected || (players[Math.floor(Math.random() * players.length)]?.username);
    if (!target) return;
    await supabase.from("skin_gifts").insert({
      game_id: GAME_ID, player_name: target, skin_name: skin,
    });
    setSuccess(`🎁 "${skin}" sent to ${target}!`);
    setSkin(""); setSelected(null);
    setTimeout(() => setSuccess(""), 4000);
  };

  return (
    <Card>
      <div style={{ fontSize: 12, color: "var(--color-text)", marginBottom: 8, fontWeight: 600 }}>Give Skin</div>
      <Input placeholder="Noobini Lovini" value={skin} onChange={e => setSkin(e.target.value)} list="skins" style={{ marginBottom: 8 }} />
      <datalist id="skins">
        {SKINS.map(s => <option key={s} value={s} />)}
      </datalist>
      <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 4 }}>Pick player (or leave empty for random):</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 8 }}>
        {players.map(p => (
          <button key={p.player_id} onClick={() => setSelected(selected === p.username ? null : p.username)} style={{
            padding: "6px 4px", borderRadius: 6,
            background: selected === p.username ? "rgba(162,89,255,0.2)" : "var(--color-bg)",
            border: `1px solid ${selected === p.username ? "var(--color-purple)" : "var(--color-border)"}`,
            color: "#fff", fontSize: 10, cursor: "pointer",
            overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>{p.username}</button>
        ))}
      </div>
      <Button onClick={send} disabled={!skin.trim()} style={{ width: "100%" }}>
        {selected ? `🎁 Send to ${selected}` : "🎁 Send to random"}
      </Button>
      {success && <div style={{ marginTop: 8, fontSize: 11, color: "var(--color-green)" }}>{success}</div>}
    </Card>
  );
}
