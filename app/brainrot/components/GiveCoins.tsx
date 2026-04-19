"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { supabase, GAME_ID } from "@/lib/supabase";
import { usePresence } from "@/lib/usePresence";
import { Card, SectionLabel, Input, Button } from "./Card";

interface Player { username: string; lifetime_points: number; player_id: string; }

const PRESETS = [1_000, 10_000, 100_000, 1_000_000];
const MAX_COINS = 1_000_000_000; // 1 billion cap per gift

function LiveDot({ live }: { live: boolean }) {
  return (
    <span style={{
      display: "inline-block", width: 8, height: 8, borderRadius: "50%",
      background: live ? "var(--color-green)" : "var(--color-border)",
      boxShadow: live ? "0 0 8px var(--color-green)" : "none",
      flexShrink: 0,
    }} />
  );
}

export default function GiveCoins() {
  const online = usePresence();
  const [players, setPlayers] = useState<Player[]>([]);
  const [query, setQuery] = useState("");
  const [picked, setPicked] = useState<Player | null>(null);
  const [amount, setAmount] = useState("");
  const [open, setOpen] = useState(false);
  const [success, setSuccess] = useState<{ msg: string; ok: boolean } | null>(null);
  const [sending, setSending] = useState(false);
  const [armedAll, setArmedAll] = useState(false);
  const armedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function fetchPlayers() {
      const { data } = await supabase.from("leaderboard")
        .select("username, lifetime_points, player_id")
        .order("lifetime_points", { ascending: false }).limit(100);
      if (data) setPlayers(data);
    }
    fetchPlayers();
    const int = setInterval(fetchPlayers, 10_000);
    return () => clearInterval(int);
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    // Sort: live players first
    const sortByLive = (a: Player, b: Player) => {
      const al = online.has(a.username.toLowerCase()) ? 0 : 1;
      const bl = online.has(b.username.toLowerCase()) ? 0 : 1;
      return al - bl;
    };
    if (!q) return [...players].sort(sortByLive).slice(0, 8);
    return players.filter(p => p.username.toLowerCase().includes(q)).sort(sortByLive).slice(0, 8);
  }, [query, players, online]);

  const targetName = picked?.username || query.trim();
  const amt = parseInt(amount) || 0;
  const overCap = amt > MAX_COINS;
  const canGive = !!targetName && amt > 0 && !overCap;
  const canGiveAll = amt > 0 && !overCap && !sending;

  const give = async () => {
    if (!canGive) return;
    if (amt > MAX_COINS) return;
    const target = targetName.toLowerCase();
    const { data: player } = await supabase.from("leaderboard")
      .select("*").eq("username", target).maybeSingle();

    if (!player) {
      setSuccess({ ok: false, msg: `Player "${targetName}" not found` });
      setTimeout(() => setSuccess(null), 4000);
      return;
    }
    const newTotal = (player.lifetime_points || 0) + amt;
    await supabase.from("leaderboard").update({ lifetime_points: newTotal })
      .eq("player_id", player.player_id);
    await supabase.from("coin_gifts").insert({
      game_id: GAME_ID, player_name: target, amount: amt,
    });
    setSuccess({ ok: true, msg: `Sent ${amt.toLocaleString()} coins to ${player.username}` });
    setAmount(""); setQuery(""); setPicked(null); setOpen(false);
    setTimeout(() => setSuccess(null), 4000);
  };

  const armOrFireAll = () => {
    if (!canGiveAll || sending) return;
    if (amt > MAX_COINS) return;
    if (!armedAll) {
      setArmedAll(true);
      if (armedTimer.current) clearTimeout(armedTimer.current);
      armedTimer.current = setTimeout(() => setArmedAll(false), 4000);
      return;
    }
    if (armedTimer.current) { clearTimeout(armedTimer.current); armedTimer.current = null; }
    setArmedAll(false);
    giveAll();
  };

  const giveAll = async () => {
    if (!canGiveAll || sending) return;
    if (amt > MAX_COINS) return;
    setSending(true);
    const { data: all } = await supabase.from("leaderboard")
      .select("player_id, username, lifetime_points");
    if (!all || all.length === 0) {
      setSuccess({ ok: false, msg: "No players found" });
      setSending(false);
      setTimeout(() => setSuccess(null), 4000);
      return;
    }
    // Skip leftover test accounts
    const recipients = all.filter(p => !p.username.toLowerCase().startsWith("testplayer"));
    // Bulk insert gift rows (one per player) so each client picks up the notification
    const gifts = recipients.map(p => ({
      game_id: GAME_ID, player_name: p.username.toLowerCase(), amount: amt,
    }));
    await supabase.from("coin_gifts").insert(gifts);
    // Update leaderboard totals in parallel
    await Promise.all(recipients.map(p =>
      supabase.from("leaderboard")
        .update({ lifetime_points: (p.lifetime_points || 0) + amt })
        .eq("player_id", p.player_id)
    ));
    setSuccess({ ok: true, msg: `Sent ${amt.toLocaleString()} coins to ${recipients.length} players` });
    setAmount(""); setQuery(""); setPicked(null); setOpen(false);
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
      <SectionLabel>Give Coins</SectionLabel>

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
            {filtered.map(p => {
              const live = online.has(p.username.toLowerCase());
              return (
                <button key={p.player_id} onMouseDown={() => pick(p)} style={{
                  display: "flex", justifyContent: "space-between", alignItems: "center",
                  gap: 8, width: "100%", padding: "8px 10px", borderRadius: 6, border: "none",
                  background: "transparent", color: "#fff", cursor: "pointer", fontSize: 12,
                  textAlign: "left",
                }}
                onMouseEnter={e => (e.currentTarget.style.background = "var(--color-bg)")}
                onMouseLeave={e => (e.currentTarget.style.background = "transparent")}>
                  <span style={{ display: "flex", alignItems: "center", gap: 8, minWidth: 0 }}>
                    <LiveDot live={live} />
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.username}</span>
                  </span>
                  <span className="font-mono" style={{ fontSize: 10, color: live ? "var(--color-amber)" : "var(--color-text-muted)" }}>
                    {(p.lifetime_points || 0).toLocaleString()}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Amount + presets */}
      <div style={{ display: "flex", gap: 4, marginBottom: 6 }}>
        {PRESETS.map(v => (
          <button key={v} onClick={() => setAmount(String(v))} style={{
            flex: 1, padding: "6px 4px", borderRadius: 6,
            border: `1px solid ${amount === String(v) ? "var(--color-amber)" : "var(--color-border)"}`,
            background: amount === String(v) ? "rgba(245,166,35,0.15)" : "var(--color-bg)",
            color: amount === String(v) ? "var(--color-amber)" : "var(--color-text-muted)",
            cursor: "pointer", fontSize: 10, fontFamily: "var(--font-jetbrains)",
          }}>
            {v >= 1_000_000 ? `${v / 1_000_000}M` : v >= 1_000 ? `${v / 1_000}k` : v}
          </button>
        ))}
      </div>
      <Input type="number" placeholder="custom amount" value={amount}
        onChange={e => setAmount(e.target.value)} style={{ marginBottom: 10 }} />

      {/* Action */}
      <Button onClick={give} disabled={!canGive} style={{
        width: "100%", background: canGive ? "var(--color-amber)" : "var(--color-border)",
        color: canGive ? "#000" : "var(--color-text-muted)",
      }}>
        {overCap
          ? `⚠ Max ${MAX_COINS.toLocaleString()} per gift`
          : canGive
            ? `🪙 Give ${amt.toLocaleString()} to ${targetName}`
            : "Pick a player and amount"}
      </Button>
      <Button onClick={armOrFireAll} disabled={!canGiveAll} style={{
        width: "100%", marginTop: 6,
        background: armedAll
          ? "var(--color-red)"
          : canGiveAll ? "rgba(162,89,255,0.18)" : "var(--color-border)",
        color: armedAll
          ? "#fff"
          : canGiveAll ? "var(--color-purple)" : "var(--color-text-muted)",
        border: `1px solid ${armedAll ? "var(--color-red)" : canGiveAll ? "var(--color-purple)" : "var(--color-border)"}`,
      }}>
        {sending
          ? "Sending…"
          : overCap
            ? `⚠ Max ${MAX_COINS.toLocaleString()} per gift`
            : armedAll
              ? `⚠ Confirm — Give ${amt.toLocaleString()} to ALL`
              : amt > 0
                ? `🌍 Give ${amt.toLocaleString()} to ALL players`
                : "Set amount to give to ALL"}
      </Button>

      {success && (
        <div style={{
          marginTop: 8, fontSize: 11,
          color: success.ok ? "var(--color-green)" : "var(--color-red)",
        }}>
          {success.ok ? "✓ " : "⚠ "}{success.msg}
        </div>
      )}
    </Card>
  );
}
