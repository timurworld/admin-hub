"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, GAME_ID } from "@/lib/supabase";
import { Card, SectionLabel, Input, Button } from "./Card";

interface Player { username: string; player_id: string; }

// Full catalog including V2 Sportini + Prestige skins + Mythic Maple Cup
// + Limited Los Hockeys. Order roughly chronological so newest skins sit at
// the bottom of the dropdown — quickest to find when picking the latest drop.
const SKINS = [
  "Noobini Lovini",
  "Romantini Grandini",
  "Lovini Lovini Lovini",
  "Teddini & Robotini",
  "Noobini Partini",
  "Cakini Presintini",
  "Lovini Rosetti",
  "Heartini Smilekurro",
  "Dragini Partini",
  "Cupidini Sahuroni",
  "Rositti Tueletti",
  "Birthdayini Cardini",
  "Cakini Elephantini",
  "Pizzini Partyini",
  "Noo Mio Heartini",
  "Cupidini Hotspottini",
  "Stick Stick",
  "No My Pucks",
  "Hockey Bros",
  "Sushiro & Soyaro",
  "Kingurini Orangini",
  "Auraberry",
  "Cupideini Hockini",
  "Los Hockeys",
  "Popini Itini",
  "Fidgetini Cubini",
  "Dragini Sqishini",
  "La Fidget Combination",
  "Spinirino",
  "Stressini Ballini",
  "Bobini Lovini",
  "Cappy Family",
  "Chillen Lemonade",
  "Cupcakini Sweetini",
  "Cuppini Triondini",
  "Lemon Lemon Sahur",
  "Lovini Vibini",
  "Toastini Butterini",
  "Candini Bucketini",
  "Ghostini Mechini",
  "Frankenstini Sharkini",
  "Vampire Dragini",
  "Headlessini Pumpkini",
  "Cupiddini Cyberini",
  "Cupiddini Divinini",
];

export default function GiveSkin() {
  const [players, setPlayers] = useState<Player[]>([]);
  const [knownSkins, setKnownSkins] = useState<Set<string>>(new Set());
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Player | null>(null);
  const [skin, setSkin] = useState("");
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState<{ msg: string; ok: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [armedAll, setArmedAll] = useState(false);
  const armedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchPlayers() {
      // Read every player, not the leaderboard top 100. Ordering by
      // lifetime_points meant new accounts -- who have the fewest points --
      // were never in the list, so they could not be picked to receive a
      // gift at all.
      const { data } = await supabase.from("players")
        .select("id, username")
        .order("username", { ascending: true }).limit(2000);
      if (data) setPlayers(data.map(p => ({ username: p.username, player_id: p.id })));
    }
    fetchPlayers();
    // The skin_gifts trigger resolves a gift by looking the name up in
    // skin_meta and returns quietly when it finds nothing, so a typo or an
    // unregistered character looks identical to a successful send. Load the
    // real list so the UI can refuse before inserting.
    (async () => {
      const { data } = await supabase.from("skin_meta").select("name");
      if (data) setKnownSkins(new Set(data.map(r => (r.name as string).toLowerCase())));
    })();
    const int = setInterval(fetchPlayers, 10_000);
    return () => clearInterval(int);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return players.slice(0, 50);
    return players.filter(p => p.username.toLowerCase().includes(q)).slice(0, 50);
  }, [query, players]);

  const targetName = picked?.username || query.trim();
  const canSend = !!targetName && !!skin.trim();
  const canSendAll = !!skin.trim() && !sending;

  const send = async () => {
    if (!canSend) return;
    let player = picked;
    if (!player) {
      const { data } = await supabase.from("leaderboard")
        .select("username, player_id").ilike("username", targetName.trim()).maybeSingle();
      player = data;
    }
    if (!player) {
      setSuccess({ ok: false, msg: `Player "${targetName}" not found` });
      setTimeout(() => setSuccess(null), 4000);
      return;
    }
    if (knownSkins.size && !knownSkins.has(skin.trim().toLowerCase())) {
      setSuccess({ ok: false, msg: `"${skin}" is not a registered skin — it would be silently dropped` });
      setTimeout(() => setSuccess(null), 5000);
      return;
    }
    const before = await supabase.from("inventory")
      .select("id", { count: "exact", head: true }).eq("player_id", player.player_id);
    await supabase.from("skin_gifts").insert({
      game_id: GAME_ID, player_name: player.username.toLowerCase(), skin_name: skin,
    });
    // The trigger fires synchronously, but give it a beat before confirming.
    await new Promise(r => setTimeout(r, 600));
    const after = await supabase.from("inventory")
      .select("id", { count: "exact", head: true }).eq("player_id", player.player_id);
    const landed = (after.count ?? 0) > (before.count ?? 0);
    setSuccess(landed
      ? { ok: true, msg: `Sent "${skin}" to ${player.username}` }
      : { ok: false, msg: `"${skin}" did not reach ${player.username} — nothing was added to their inventory` });
    setSkin(""); setQuery(""); setPicked(null); setOpen(false);
    setTimeout(() => setSuccess(null), 4000);
  };

  const armOrFireAll = () => {
    if (!canSendAll) return;
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

  // Pick a single random player and gift them the skin.
  const sendRandom = async () => {
    if (!canSendAll) return;
    setSending(true);
    const { data: all } = await supabase.from("leaderboard").select("username");
    const eligible = (all || []).filter(p => !p.username.toLowerCase().startsWith("testplayer"));
    if (eligible.length === 0) {
      setSuccess({ ok: false, msg: "No eligible players" });
      setSending(false);
      setTimeout(() => setSuccess(null), 4000);
      return;
    }
    const target = eligible[Math.floor(Math.random() * eligible.length)];
    await supabase.from("skin_gifts").insert({
      game_id: GAME_ID, player_name: target.username.toLowerCase(), skin_name: skin,
    });
    setSuccess({ ok: true, msg: `🎲 Random pick: "${skin}" → ${target.username}` });
    setSkin(""); setQuery(""); setPicked(null); setOpen(false);
    setSending(false);
    setTimeout(() => setSuccess(null), 5000);
  };

  const sendAll = async () => {
    if (!canSendAll) return;
    setSending(true);
    const { data: all } = await supabase.from("leaderboard").select("username");
    if (!all || all.length === 0) {
      setSuccess({ ok: false, msg: "No players found" });
      setSending(false);
      setTimeout(() => setSuccess(null), 4000);
      return;
    }
    const recipients = all.filter(p => !p.username.toLowerCase().startsWith("testplayer"));
    const gifts = recipients.map(p => ({
      game_id: GAME_ID, player_name: p.username.toLowerCase(), skin_name: skin,
    }));
    await supabase.from("skin_gifts").insert(gifts);
    setSuccess({ ok: true, msg: `Sent "${skin}" to ${recipients.length} players` });
    setSkin(""); setQuery(""); setPicked(null); setOpen(false);
    setSending(false);
    setTimeout(() => setSuccess(null), 4000);
  };

  const pick = (p: Player) => {
    setPicked(p);
    setQuery(p.username);
    setOpen(false);
    inputRef.current?.blur();
  };

  const clearPick = () => {
    setPicked(null);
    setQuery("");
    setOpen(true);
    inputRef.current?.focus();
  };

  return (
    <Card>
      <SectionLabel>Give Skin</SectionLabel>

      {/* Player picker */}
      <div style={{ position: "relative", marginBottom: 8 }}>
        <div style={{ position: "relative" }}>
          <Input
            ref={inputRef}
            placeholder="Search a player by name…"
            value={query}
            onChange={e => { setQuery(e.target.value); setPicked(null); setOpen(true); }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)}
            style={{ paddingRight: picked ? 32 : 12 }}
          />
          {picked && (
            <button onClick={clearPick} aria-label="Clear" style={{
              position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)",
              width: 20, height: 20, borderRadius: "50%", border: "none",
              background: "var(--color-border)", color: "var(--color-text-muted)",
              cursor: "pointer", fontSize: 12, lineHeight: "20px", padding: 0,
            }}>×</button>
          )}
        </div>

        {open && filtered.length > 0 && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, marginTop: 4,
            background: "var(--color-card)", border: "1px solid var(--color-border)",
            borderRadius: 8, padding: 4, zIndex: 10,
            boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            maxHeight: 280, overflow: "auto",
          }}>
            {filtered.map(p => (
              <button key={p.player_id} onMouseDown={() => pick(p)} style={{
                display: "block", width: "100%", padding: "8px 10px",
                borderRadius: 6, border: "none", background: "transparent",
                color: "#fff", cursor: "pointer", fontSize: 12, textAlign: "left",
              }}
              onMouseEnter={e => (e.currentTarget.style.background = "var(--color-bg)")}
              onMouseLeave={e => (e.currentTarget.style.background = "transparent")}
              >{p.username}</button>
            ))}
          </div>
        )}
      </div>

      {/* Skin name */}
      <Input
        placeholder="Skin name (e.g. Noobini Lovini)"
        value={skin}
        onChange={e => setSkin(e.target.value)}
        list="skins"
        style={{ marginBottom: 8 }}
      />
      <datalist id="skins">
        {SKINS.map(s => <option key={s} value={s} />)}
      </datalist>

      <Button onClick={send} disabled={!canSend} style={{ width: "100%" }}>
        {targetName && skin ? `🎁 Send "${skin}" to ${targetName}` : "🎁 Send"}
      </Button>

      {/* Random player — picks one at random for surprise gifts. */}
      <Button onClick={sendRandom} disabled={!canSendAll} style={{
        width: "100%", marginTop: 6,
        background: canSendAll ? "rgba(0,212,255,0.15)" : "var(--color-border)",
        color: canSendAll ? "var(--color-cyan, #00d4ff)" : "var(--color-text-muted)",
        border: `1px solid ${canSendAll ? "rgba(0,212,255,0.4)" : "var(--color-border)"}`,
      }}>
        {sending
          ? "Sending…"
          : skin
            ? `🎲 Send "${skin}" to RANDOM player`
            : "Pick a skin to send to a random player"}
      </Button>

      <Button onClick={armOrFireAll} disabled={!canSendAll} style={{
        width: "100%", marginTop: 6,
        background: armedAll
          ? "var(--color-red)"
          : canSendAll ? "rgba(162,89,255,0.18)" : "var(--color-border)",
        color: armedAll
          ? "#fff"
          : canSendAll ? "var(--color-purple)" : "var(--color-text-muted)",
        border: `1px solid ${armedAll ? "var(--color-red)" : canSendAll ? "var(--color-purple)" : "var(--color-border)"}`,
      }}>
        {sending
          ? "Sending…"
          : armedAll
            ? `⚠ Confirm — send "${skin}" to ALL`
            : "🌍 Send to ALL players"}
      </Button>

      {success && (
        <div style={{ marginTop: 8, fontSize: 11, color: success.ok ? "var(--color-green)" : "var(--color-red)" }}>
          {success.ok ? "✓ " : "⚠ "}{success.msg}
        </div>
      )}
    </Card>
  );
}
