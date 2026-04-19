"use client";

import { useEffect, useRef, useState } from "react";
import { supabase, GAME_ID } from "@/lib/supabase";
import { usePresence } from "@/lib/usePresence";
import { Card, Input, Button } from "./Card";

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
  const [sending, setSending] = useState(false);
  const [armedAll, setArmedAll] = useState(false);
  const armedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const online = usePresence();

  useEffect(() => {
    async function fetchPlayers() {
      const { data } = await supabase.from("leaderboard")
        .select("username, player_id")
        .order("lifetime_points", { ascending: false }).limit(50);
      if (data) setPlayers(data);
    }
    fetchPlayers();
    const i = setInterval(fetchPlayers, 10_000);
    return () => clearInterval(i);
  }, []);

  // Sort live players first
  const sortedPlayers = [...players].sort((a, b) => {
    const al = online.has(a.username.toLowerCase()) ? 0 : 1;
    const bl = online.has(b.username.toLowerCase()) ? 0 : 1;
    return al - bl;
  });

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

  const armOrFireAll = () => {
    if (!skin.trim() || sending) return;
    if (!armedAll) {
      setArmedAll(true);
      if (armedTimer.current) clearTimeout(armedTimer.current);
      armedTimer.current = setTimeout(() => setArmedAll(false), 4000);
      return;
    }
    if (armedTimer.current) { clearTimeout(armedTimer.current); armedTimer.current = null; }
    setArmedAll(false);
    sendAll();
  };

  const sendAll = async () => {
    if (!skin.trim() || sending) return;
    setSending(true);
    const { data: all } = await supabase.from("leaderboard")
      .select("username");
    if (!all || all.length === 0) {
      setSuccess("⚠ No players found");
      setSending(false);
      setTimeout(() => setSuccess(""), 4000);
      return;
    }
    const recipients = all.filter(p => !p.username.toLowerCase().startsWith("testplayer"));
    const gifts = recipients.map(p => ({
      game_id: GAME_ID, player_name: p.username.toLowerCase(), skin_name: skin,
    }));
    await supabase.from("skin_gifts").insert(gifts);
    setSuccess(`🎁 "${skin}" sent to ${recipients.length} players!`);
    setSkin(""); setSelected(null);
    setSending(false);
    setTimeout(() => setSuccess(""), 4000);
  };

  return (
    <Card>
      <div style={{ fontSize: 12, color: "var(--color-text)", marginBottom: 8, fontWeight: 600 }}>Give Skin</div>
      <Input placeholder="Noobini Lovini" value={skin} onChange={e => setSkin(e.target.value)} list="skins" style={{ marginBottom: 8 }} />
      <datalist id="skins">
        {SKINS.map(s => <option key={s} value={s} />)}
      </datalist>
      <div style={{ fontSize: 10, color: "var(--color-text-muted)", marginBottom: 4 }}>
        Pick player (or leave empty for random) · <span style={{ color: "var(--color-green)" }}>● {online.size} live now</span>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 4, marginBottom: 8 }}>
        {sortedPlayers.map(p => {
          const live = online.has(p.username.toLowerCase());
          const isSelected = selected === p.username;
          return (
            <button key={p.player_id} onClick={() => setSelected(isSelected ? null : p.username)} style={{
              padding: "6px 6px", borderRadius: 6,
              background: isSelected ? "rgba(162,89,255,0.2)" : "var(--color-bg)",
              border: `1px solid ${isSelected ? "var(--color-purple)" : "var(--color-border)"}`,
              color: live ? "#fff" : "var(--color-text-muted)",
              fontSize: 10, cursor: "pointer",
              display: "flex", alignItems: "center", gap: 5, minWidth: 0,
              opacity: live ? 1 : 0.7,
            }}>
              <span style={{
                display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                background: live ? "var(--color-green)" : "var(--color-border)",
                boxShadow: live ? "0 0 6px var(--color-green)" : "none",
                flexShrink: 0,
              }} />
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.username}</span>
            </button>
          );
        })}
      </div>
      <Button onClick={send} disabled={!skin.trim()} style={{ width: "100%" }}>
        {selected ? `🎁 Send to ${selected}` : "🎁 Send to random"}
      </Button>
      <Button onClick={armOrFireAll} disabled={!skin.trim() || sending} style={{
        width: "100%", marginTop: 6,
        background: armedAll
          ? "var(--color-red)"
          : skin.trim() && !sending ? "rgba(162,89,255,0.18)" : "var(--color-border)",
        color: armedAll
          ? "#fff"
          : skin.trim() && !sending ? "var(--color-purple)" : "var(--color-text-muted)",
        border: `1px solid ${armedAll ? "var(--color-red)" : skin.trim() && !sending ? "var(--color-purple)" : "var(--color-border)"}`,
      }}>
        {sending
          ? "Sending…"
          : armedAll
            ? `⚠ Confirm — send "${skin}" to ALL`
            : "🌍 Send to ALL players"}
      </Button>
      {success && <div style={{ marginTop: 8, fontSize: 11, color: "var(--color-green)" }}>{success}</div>}
    </Card>
  );
}
