"use client";

import { useEffect, useState } from "react";
import { supabase, GAME_ID } from "@/lib/supabase";
import { Card, SectionLabel, Input, Button } from "./Card";

interface Player { username: string; lifetime_points: number; player_id: string; }

export default function GiveCoins() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [manual, setManual] = useState("");
  const [amount, setAmount] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from("leaderboard")
        .select("username, lifetime_points, player_id")
        .order("lifetime_points", { ascending: false }).limit(9);
      if (data) setPlayers(data);
    }
    fetch();
    const int = setInterval(fetch, 5000);
    return () => clearInterval(int);
  }, []);

  const give = async () => {
    const target = selected || manual.trim();
    const amt = parseInt(amount);
    if (!target || !amt) return;

    const { data: player } = await supabase.from("leaderboard")
      .select("*").eq("username", target.toLowerCase()).maybeSingle();

    if (player) {
      const newTotal = (player.lifetime_points || 0) + amt;
      await supabase.from("leaderboard").update({ lifetime_points: newTotal })
        .eq("player_id", player.player_id);
      await supabase.from("coin_gifts").insert({
        game_id: GAME_ID, player_name: target, amount: amt,
      });
      setSuccess(`✓ Gave ${amt.toLocaleString()} coins to ${target}! Total: ${newTotal.toLocaleString()}`);
    } else {
      setSuccess(`⚠ Player "${target}" not found`);
    }
    setAmount(""); setManual(""); setSelected(null);
    setTimeout(() => setSuccess(""), 4000);
  };

  return (
    <Card>
      <SectionLabel>Giveaways — always available</SectionLabel>
      <div style={{ fontSize: 12, color: "var(--color-text)", marginBottom: 8, fontWeight: 600 }}>Give Coins</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 8 }}>
        {players.map(p => (
          <button key={p.player_id} onClick={() => setSelected(p.username)} style={{
            padding: "6px 4px", borderRadius: 6,
            background: selected === p.username ? "rgba(245,166,35,0.2)" : "var(--color-bg)",
            border: `1px solid ${selected === p.username ? "var(--color-amber)" : "var(--color-border)"}`,
            color: "#fff", fontSize: 10, cursor: "pointer",
            textAlign: "left", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
          }}>
            <div style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{p.username}</div>
            <div className="font-mono" style={{ fontSize: 9, color: "var(--color-amber)" }}>
              {(p.lifetime_points || 0).toLocaleString()}
            </div>
          </button>
        ))}
      </div>
      <div style={{ fontSize: 10, color: "var(--color-text-muted)", textAlign: "center", margin: "6px 0" }}>— or type name —</div>
      <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
        <Input placeholder="player" value={manual} onChange={e => setManual(e.target.value)} style={{ flex: 1 }} />
        <Input type="number" placeholder="coins" value={amount} onChange={e => setAmount(e.target.value)} style={{ width: 90 }} />
      </div>
      <Button onClick={give} disabled={(!selected && !manual.trim()) || !amount} style={{
        width: "100%", background: "var(--color-amber)", color: "#000"
      }}>Give Coins</Button>
      {success && <div style={{ marginTop: 8, fontSize: 11, color: "var(--color-green)" }}>{success}</div>}
    </Card>
  );
}
