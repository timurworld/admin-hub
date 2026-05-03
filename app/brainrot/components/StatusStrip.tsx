"use client";

// Always-visible at-a-glance status of every major system. Sits at the top
// of the left controls panel so the operator never has to scroll to see
// "is the locker still active?", "what's drop stock at?", etc.
//
// Each chip is clickable — emits a `scrollTo` event the page listens for to
// jump down to the matching card.

import { useEffect, useState } from "react";
import { supabase, GAME_ID } from "@/lib/supabase";
import { usePresence } from "@/lib/usePresence";

interface Locker {
  id: string; name: string; remaining_stock: number; total_stock: number;
  status: string; admin_only: boolean; expires_at: string | null;
}
interface DropEvent {
  id: string; name: string; status: string; admin_only: boolean;
  drop_pool: { skin_id: number; total: number; remaining: number }[];
  current_wave_skin_id: number | null; current_wave_ends_at: string | null;
}

function timeLeft(iso: string | null): string {
  if (!iso) return "";
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return "ended";
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return `${h}h ${m}m`;
  const s = Math.floor((ms % 60000) / 1000);
  return `${m}m ${s}s`;
}

function jumpTo(targetId: string) {
  if (typeof window === "undefined") return;
  document.getElementById(targetId)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

const Chip = ({ icon, label, value, color, onClick, dim, title }: {
  icon: string; label: string; value: string; color?: string;
  onClick?: () => void; dim?: boolean; title?: string;
}) => (
  <button
    onClick={onClick}
    title={title}
    style={{
      display: "flex", alignItems: "center", gap: 6,
      padding: "5px 10px", borderRadius: 999,
      background: dim ? "rgba(255,255,255,0.04)" : "rgba(255,255,255,0.08)",
      border: `1px solid ${color || "var(--color-border)"}`,
      color: dim ? "var(--color-text-muted)" : "#fff",
      fontSize: 11, cursor: onClick ? "pointer" : "default",
      whiteSpace: "nowrap", transition: "background 0.15s",
      fontFamily: "inherit",
    }}
  >
    <span style={{ fontSize: 13 }}>{icon}</span>
    <span style={{ color: dim ? "var(--color-text-muted)" : (color || "#fff"), fontWeight: 600 }}>{label}</span>
    {value && <span style={{ color: "var(--color-text-muted)", fontFamily: "var(--font-jetbrains)" }}>{value}</span>}
  </button>
);

// Country code → flag emoji (regional indicator pair). 'CA' → 🇨🇦, 'US' → 🇺🇸, etc.
function flag(cc: string | null | undefined): string {
  if (!cc || cc.length !== 2) return "";
  const A = 0x1f1e6, base = "A".charCodeAt(0);
  return String.fromCodePoint(A + cc.charCodeAt(0) - base, A + cc.charCodeAt(1) - base);
}

interface GeoRow { city: string | null; country: string | null; country_code: string | null; }

export default function StatusStrip() {
  const [eventActive, setEventActive] = useState(false);
  const [eventName, setEventName] = useState("");
  const [locker, setLocker] = useState<Locker | null>(null);
  const [dropEvent, setDropEvent] = useState<DropEvent | null>(null);
  const [tradeCount, setTradeCount] = useState(0);
  const [, setTick] = useState(0); // for live-updating countdowns
  const [showOnline, setShowOnline] = useState(false);
  const [geoMap, setGeoMap] = useState<Record<string, GeoRow>>({});
  const online = usePresence();

  // Fetch geo data for online players when the dropdown opens. Cheap query
  // (one round-trip filtered by usernames) and we only refetch when the set
  // of online players changes, not every render.
  useEffect(() => {
    if (!showOnline || online.size === 0) return;
    const usernames = [...online];
    (async () => {
      const { data } = await supabase
        .from("players")
        .select("username, city, country, country_code")
        .in("username", usernames.map(n => n.toLowerCase()));
      if (!data) return;
      const map: Record<string, GeoRow> = {};
      data.forEach((row: { username: string; city: string | null; country: string | null; country_code: string | null }) => {
        map[row.username.toLowerCase()] = { city: row.city, country: row.country, country_code: row.country_code };
      });
      setGeoMap(map);
    })();
  }, [showOnline, online]);

  useEffect(() => {
    async function refreshAll() {
      const [ev, lk, de, tr] = await Promise.all([
        supabase.from("admin_events").select("active, event_name").eq("game_id", GAME_ID).maybeSingle(),
        supabase.from("lockers").select("*").eq("status", "active").order("starts_at", { ascending: false }).limit(1),
        supabase.from("drop_events").select("*").eq("status", "active").order("starts_at", { ascending: false }).limit(1),
        supabase.from("trade_listings").select("*", { count: "exact", head: true }).eq("status", "active"),
      ]);
      setEventActive(ev.data?.active ?? false);
      setEventName(ev.data?.event_name ?? "");
      setLocker((lk.data?.[0] as Locker) ?? null);
      setDropEvent((de.data?.[0] as DropEvent) ?? null);
      setTradeCount(tr.count ?? 0);
    }
    refreshAll();

    const sub = supabase.channel("status-strip")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_events" }, refreshAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "lockers" }, refreshAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "drop_events" }, refreshAll)
      .on("postgres_changes", { event: "*", schema: "public", table: "trade_listings" }, refreshAll)
      .subscribe();

    // Tick every 1s so countdowns refresh without refetching
    const t = setInterval(() => setTick(x => x + 1), 1000);

    return () => { supabase.removeChannel(sub); clearInterval(t); };
  }, []);

  const dropRemaining = dropEvent?.drop_pool?.reduce((acc, p) => acc + (p.remaining || 0), 0) ?? 0;
  const dropTotal = dropEvent?.drop_pool?.reduce((acc, p) => acc + (p.total || 0), 0) ?? 0;
  const waveLive = !!(dropEvent?.current_wave_ends_at && new Date(dropEvent.current_wave_ends_at) > new Date());
  const waveSec = waveLive && dropEvent?.current_wave_ends_at
    ? Math.max(0, Math.floor((new Date(dropEvent.current_wave_ends_at).getTime() - Date.now()) / 1000))
    : 0;

  return (
    <div style={{
      display: "flex", flexWrap: "wrap", gap: 6,
      padding: "10px 8px",
      background: "var(--color-bg)",
      borderRadius: 10,
      border: "1px solid var(--color-border)",
      marginBottom: 8,
      position: "sticky", top: 0, zIndex: 10,
    }}>
      <Chip
        icon={eventActive ? "🔴" : "⚫"}
        label={eventActive ? "LIVE" : "OFFLINE"}
        value={eventActive ? eventName || "" : ""}
        color={eventActive ? "var(--color-red)" : undefined}
        dim={!eventActive}
        onClick={() => jumpTo("section-live")}
        title="Live event toggle"
      />
      {locker ? (
        <Chip
          icon="🔐"
          label={locker.name}
          value={`${locker.remaining_stock}/${locker.total_stock}${locker.admin_only ? " · DRY" : ""}`}
          color={locker.admin_only ? "#ff8c00" : "#ffd700"}
          onClick={() => jumpTo("section-events")}
          title={`Closes in ${timeLeft(locker.expires_at)}`}
        />
      ) : (
        <Chip icon="🔐" label="Locker" value="—" dim onClick={() => jumpTo("section-events")} />
      )}
      {dropEvent ? (
        <Chip
          icon="🎁"
          label={waveLive ? `${dropEvent.name} ⚡${waveSec}s` : dropEvent.name}
          value={`${dropRemaining}/${dropTotal}${dropEvent.admin_only ? " · DRY" : ""}`}
          color={waveLive ? "#ffd700" : (dropEvent.admin_only ? "#ff8c00" : "#2ecc71")}
          onClick={() => jumpTo("section-events")}
          title={waveLive ? `Wave ends in ${waveSec}s` : "Drop event"}
        />
      ) : (
        <Chip icon="🎁" label="Drops" value="—" dim onClick={() => jumpTo("section-events")} />
      )}
      <Chip
        icon="📋"
        label="Trades"
        value={String(tradeCount)}
        dim={tradeCount === 0}
      />
      <div style={{ position: "relative" }}>
        <Chip
          icon="👥"
          label="Online"
          value={String(online.size)}
          dim={online.size === 0}
          onClick={() => setShowOnline(s => !s)}
          title={online.size === 0 ? "No one online right now" : "Click to see who's online"}
        />
        {showOnline && (
          <>
            {/* click-outside backdrop */}
            <div onClick={() => setShowOnline(false)} style={{
              position: "fixed", inset: 0, zIndex: 19,
            }} />
            <div style={{
              position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 20,
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 10,
              padding: 10,
              minWidth: 180, maxHeight: 280, overflow: "auto",
              boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
            }}>
              <div style={{
                fontSize: 10, color: "var(--color-text-muted)",
                letterSpacing: "0.18em", textTransform: "uppercase",
                paddingBottom: 6, marginBottom: 6,
                borderBottom: "1px solid var(--color-border)",
              }}>
                Online · {online.size}
              </div>
              {online.size === 0 ? (
                <div style={{ fontSize: 12, color: "var(--color-text-muted)", padding: "8px 4px" }}>
                  Nobody live yet.
                </div>
              ) : (
                [...online].map(name => {
                  const geo = geoMap[name.toLowerCase()];
                  const locLabel = geo
                    ? [geo.city, geo.country_code].filter(Boolean).join(", ")
                    : null;
                  return (
                    <div key={name} style={{
                      display: "flex", alignItems: "center", gap: 8,
                      padding: "4px 6px", fontSize: 12, color: "#fff",
                      borderRadius: 6,
                    }}>
                      <span style={{
                        width: 6, height: 6, borderRadius: "50%",
                        background: "var(--color-green)",
                        boxShadow: "0 0 6px var(--color-green)",
                      }} />
                      <span style={{ fontFamily: "var(--font-jetbrains)", flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                      {locLabel && (
                        <span title={geo?.country || locLabel} style={{
                          fontSize: 10, color: "var(--color-text-muted)",
                          fontFamily: "var(--font-jetbrains)", whiteSpace: "nowrap",
                        }}>
                          {flag(geo?.country_code)} {locLabel}
                        </span>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
