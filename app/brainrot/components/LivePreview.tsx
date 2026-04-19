"use client";

import { useEffect, useState, useRef } from "react";
import { supabase, GAME_ID, EFFECTS } from "@/lib/supabase";

export default function LivePreview() {
  const [eventActive, setEventActive] = useState(false);
  const [eventStarted, setEventStarted] = useState<string | null>(null);
  const [elapsed, setElapsed] = useState("00:00");
  const [scheduled, setScheduled] = useState<{ event_name: string; scheduled_for: string } | null>(null);
  const [countdown, setCountdown] = useState("");
  const [effects, setEffects] = useState<Record<string, boolean>>({});
  const [coins, setCoins] = useState(1337);

  useEffect(() => {
    async function fetchAll() {
      const { data: ev } = await supabase.from("admin_events").select("*").eq("game_id", GAME_ID).single();
      if (ev) { setEventActive(ev.active); setEventStarted(ev.started_at); }

      const { data: sc } = await supabase.from("scheduled_events")
        .select("*").eq("game_id", GAME_ID)
        .gt("scheduled_for", new Date().toISOString())
        .order("scheduled_for", { ascending: true }).limit(1).maybeSingle();
      if (sc) setScheduled(sc);

      const { data: fx } = await supabase.from("active_effects").select("effect_id, active").eq("game_id", GAME_ID);
      if (fx) {
        const map: Record<string, boolean> = {};
        fx.forEach((r: { effect_id: string; active: boolean }) => { map[r.effect_id] = r.active; });
        setEffects(map);
      }
    }
    fetchAll();

    const sub = supabase.channel("preview")
      .on("postgres_changes", { event: "*", schema: "public", table: "admin_events" }, (p) => {
        const r = p.new as { active?: boolean; started_at?: string };
        if (r?.active !== undefined) { setEventActive(r.active); setEventStarted(r.started_at || null); }
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "active_effects" }, (p) => {
        const r = p.new as { effect_id?: string; active?: boolean };
        if (r?.effect_id) setEffects(prev => ({ ...prev, [r.effect_id!]: !!r.active }));
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "scheduled_events" }, fetchAll)
      .subscribe();

    return () => { supabase.removeChannel(sub); };
  }, []);

  useEffect(() => {
    if (!eventActive || !eventStarted) return;
    const i = setInterval(() => {
      const s = Math.floor((Date.now() - new Date(eventStarted).getTime()) / 1000);
      setElapsed(`${String(Math.floor(s/60)).padStart(2,"0")}:${String(s%60).padStart(2,"0")}`);
    }, 500);
    return () => clearInterval(i);
  }, [eventActive, eventStarted]);

  useEffect(() => {
    if (!scheduled) return;
    const i = setInterval(() => {
      const diff = new Date(scheduled.scheduled_for).getTime() - Date.now();
      if (diff <= 0) { setCountdown("STARTING..."); return; }
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setCountdown(`${d}d ${String(h).padStart(2,"0")}h ${String(m).padStart(2,"0")}m ${String(s).padStart(2,"0")}s`);
    }, 1000);
    return () => clearInterval(i);
  }, [scheduled]);

  // Coin tsunami adds coins
  useEffect(() => {
    if (effects.tsunami) {
      const i = setInterval(() => setCoins(c => c + Math.floor(Math.random() * 50 + 10)), 500);
      return () => clearInterval(i);
    }
  }, [effects.tsunami]);

  return (
    <div style={{
      position: "absolute", inset: 20, borderRadius: 16, overflow: "hidden",
      background: "linear-gradient(180deg, #1a0e3a, #0f0825)",
      border: "1px solid var(--color-border)",
    }}>
      {/* Countdown banner (scheduled) */}
      {scheduled && !eventActive && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
          background: "linear-gradient(90deg, rgba(162,89,255,0.3), rgba(74,158,255,0.3))",
          borderBottom: "1px solid var(--color-purple)",
          padding: "10px 16px", textAlign: "center",
        }}>
          <div style={{ fontSize: 12, color: "var(--color-purple)" }} className="font-heading btn-upper">
            ⚡ Admin Abuse in <span className="font-mono">{countdown}</span>
          </div>
          <div style={{ fontSize: 10, color: "#fff", marginTop: 2 }}>{scheduled.event_name}</div>
        </div>
      )}

      {/* Live event strip */}
      {eventActive && (
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 10,
          background: "rgba(255,74,74,0.2)",
          borderBottom: "1px solid var(--color-red)",
          padding: "8px 16px", display: "flex", justifyContent: "space-between", alignItems: "center",
          animation: "glow-purple 1s ease-in-out infinite",
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span className="pulse-dot" style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--color-red)" }} />
            <span className="font-heading btn-upper" style={{ fontSize: 12, color: "var(--color-red)" }}>🔴 Admin Abuse Live</span>
          </div>
          <span className="font-mono" style={{ fontSize: 13, color: "#fff" }}>{elapsed}</span>
        </div>
      )}

      {/* Coin counter */}
      <div style={{
        position: "absolute", top: eventActive || scheduled ? 56 : 16, left: 16, zIndex: 8,
        background: "rgba(0,0,0,0.5)", backdropFilter: "blur(8px)",
        padding: "8px 14px", borderRadius: 8, border: "1px solid var(--color-border)",
        display: "flex", alignItems: "center", gap: 8,
      }}>
        <span style={{ fontSize: 14 }}>🪙</span>
        <span className="font-mono" style={{ color: "var(--color-amber)", fontSize: 16, fontWeight: 700 }}>
          {coins.toLocaleString()}
        </span>
      </div>

      {/* Active character */}
      <div style={{
        position: "absolute", top: "45%", left: "50%", transform: "translate(-50%, -50%)",
        width: 180, height: 180, zIndex: 5,
      }} className="float-char">
        <div style={{
          position: "absolute", inset: 0, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,105,180,0.3), transparent 70%)",
          filter: "blur(20px)",
        }} />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="https://timur.world/characters/01_noobini_lovini.png" alt="Character"
          style={{
            width: "100%", height: "100%", objectFit: "contain", position: "relative", zIndex: 2,
            filter: "drop-shadow(0 0 20px rgba(255,105,180,0.6))",
          }} />
      </div>

      {/* Label */}
      <div style={{
        position: "absolute", bottom: 16, left: 16, right: 16, textAlign: "center",
        fontSize: 11, color: "var(--color-text-muted)",
      }}>
        Effects fire here in real time — this is what your players see
      </div>

      {/* Effect renderers */}
      {effects.disco && <DiscoFX />}
      {effects.fireworks && <FireworksFX />}
      {effects.poop && <PoopFX />}
      {effects.rocket && <RocketFX />}
      {effects.cats && <CatsFX />}
      {effects.tsunami && <TsunamiFX />}
      {effects.lightning && <LightningFX />}
      {effects.bomb && <BombFX />}
      {effects.crowd && <CrowdFX />}
    </div>
  );
}

function DiscoFX() {
  return (
    <>
      <div style={{
        position: "absolute", inset: 0, background: "linear-gradient(45deg, #ff00ff20, #00ffff20, #ffff0020, #ff00ff20)",
        backgroundSize: "400% 400%", animation: "disco-wash 2s linear infinite", zIndex: 6, pointerEvents: "none",
      }} />
      <div style={{
        position: "absolute", top: 10, left: "50%", transform: "translateX(-50%)",
        width: 60, height: 60, borderRadius: "50%",
        background: "radial-gradient(circle, #ccc, #666)",
        boxShadow: "0 0 40px #ff00ff",
        animation: "disco-swing 2s ease-in-out infinite",
        zIndex: 7,
      }}>🪩</div>
      <style>{`
        @keyframes disco-wash { 0% { background-position: 0% 0%; } 100% { background-position: 400% 400%; } }
        @keyframes disco-swing { 0%,100% { transform: translateX(-50%) rotate(-15deg); } 50% { transform: translateX(-50%) rotate(15deg); } }
      `}</style>
    </>
  );
}

function FireworksFX() {
  return (
    <>
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{
          position: "absolute", bottom: 0, left: `${20 + i * 15}%`,
          width: 4, height: 4, borderRadius: "50%", background: ["#ff0","#f0f","#0ff","#f00","#0f0"][i],
          animation: `fw-rocket ${1.5 + i*0.2}s ease-out infinite`, zIndex: 7,
        }} />
      ))}
      <style>{`
        @keyframes fw-rocket {
          0% { bottom: 0; opacity: 1; transform: scale(1); }
          70% { bottom: 70%; opacity: 1; transform: scale(1); }
          100% { bottom: 70%; opacity: 0; transform: scale(8); box-shadow: 0 0 30px currentColor; }
        }
      `}</style>
    </>
  );
}

function PoopFX() {
  return (
    <>
      {[...Array(30)].map((_, i) => (
        <div key={i} style={{
          position: "absolute", top: -40, left: `${(i * 7) % 100}%`,
          fontSize: 24 + (i % 3) * 6, animation: `poop-fall ${2 + (i % 4)}s linear infinite`,
          animationDelay: `${(i * 0.2) % 3}s`, zIndex: 7,
        }}>💩</div>
      ))}
      <style>{`
        @keyframes poop-fall { 0% { top: -40px; } 100% { top: 110%; } }
      `}</style>
    </>
  );
}

function RocketFX() {
  return (
    <div style={{
      position: "absolute", bottom: 0, left: "50%", transform: "translateX(-50%)",
      fontSize: 80, animation: "rocket-launch 3s ease-out forwards", zIndex: 9,
    }}>🚀
      <style>{`@keyframes rocket-launch { 0% { bottom: 0; } 100% { bottom: 120%; } }`}</style>
    </div>
  );
}

function CatsFX() {
  return (
    <>
      {[...Array(8)].map((_, i) => (
        <div key={i} style={{
          position: "absolute", top: `${10 + i*10}%`, left: -60,
          fontSize: 40, animation: `cat-zoom ${2 + (i%3)*0.5}s linear infinite`,
          animationDelay: `${i*0.3}s`, zIndex: 7,
          filter: `hue-rotate(${i * 45}deg)`,
        }}>🐱</div>
      ))}
      <style>{`@keyframes cat-zoom { 0% { left: -60px; } 100% { left: 120%; } }`}</style>
    </>
  );
}

function TsunamiFX() {
  return (
    <>
      <div style={{
        position: "absolute", bottom: 0, left: 0, right: 0, height: "60%",
        background: "linear-gradient(180deg, transparent, rgba(0,212,255,0.4))",
        animation: "tsu-wave 2s ease-in-out infinite", zIndex: 6,
      }} />
      {[...Array(15)].map((_, i) => (
        <div key={i} style={{
          position: "absolute", bottom: `${Math.random()*60}%`, left: `${Math.random()*100}%`,
          fontSize: 20, animation: `coin-pop ${1 + Math.random()}s ease-out infinite`,
          animationDelay: `${Math.random()*2}s`, zIndex: 7,
        }}>🪙</div>
      ))}
      <style>{`
        @keyframes tsu-wave { 0%,100% { transform: translateY(10px); } 50% { transform: translateY(-10px); } }
        @keyframes coin-pop { 0% { transform: scale(0); } 50% { transform: scale(1.3); } 100% { transform: scale(0); opacity: 0; } }
      `}</style>
    </>
  );
}

function LightningFX() {
  return (
    <>
      <div style={{
        position: "absolute", inset: 0, background: "rgba(255,226,61,0.2)",
        animation: "lightning-flash 0.5s ease-in-out infinite", zIndex: 6, pointerEvents: "none",
      }} />
      {[...Array(5)].map((_, i) => (
        <div key={i} style={{
          position: "absolute", top: `${Math.random()*60}%`, left: `${Math.random()*90}%`,
          fontSize: 50, animation: `lightning-strike 0.8s ease-out infinite`,
          animationDelay: `${i*0.2}s`, zIndex: 7,
        }}>⚡</div>
      ))}
      <style>{`
        @keyframes lightning-flash { 0%,100% { opacity: 0; } 50% { opacity: 1; } }
        @keyframes lightning-strike { 0%,100% { opacity: 0; transform: scale(0.5); } 50% { opacity: 1; transform: scale(1.5); } }
      `}</style>
    </>
  );
}

function BombFX() {
  const chars = ["01_noobini_lovini","02_la_romantic_grande","03_lovini_lovini_lovini","04_teddy_and_rosie","05_noobini_partini","06_cakini_and_presintini","07_lovin_rose","08_heartini_smilekur","09_dragon_partyini"];
  return (
    <>
      {chars.map((c, i) => {
        const angle = (i / chars.length) * 360;
        return (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={c} src={`https://timur.world/characters/${c}.png`} alt=""
            style={{
              position: "absolute", top: "45%", left: "50%",
              width: 60, height: 60, zIndex: 9,
              animation: `bomb-explode 3s ease-out forwards`,
              ["--ang" as string]: `${angle}deg`,
            } as React.CSSProperties} />
        );
      })}
      <style>{`
        @keyframes bomb-explode {
          0% { transform: translate(-50%, -50%) rotate(var(--ang)) translateY(0) rotate(calc(-1 * var(--ang))); opacity: 1; }
          100% { transform: translate(-50%, -50%) rotate(var(--ang)) translateY(-400px) rotate(calc(-1 * var(--ang))); opacity: 0; }
        }
      `}</style>
    </>
  );
}

function CrowdFX() {
  const emojis = ["🎉","🥳","🎊","👏","🙌","🎤","🔥"];
  return (
    <>
      <div style={{
        position: "absolute", top: "20%", left: 0, right: 0, textAlign: "center", zIndex: 9,
        fontSize: 32, fontWeight: 900, color: "#fff",
        textShadow: "0 0 20px #00e87a, 0 0 40px #00e87a",
        animation: "crowd-pulse 0.5s ease-in-out infinite",
      }} className="font-heading btn-upper">THE CROWD GOES WILD</div>
      {[...Array(20)].map((_, i) => (
        <div key={i} style={{
          position: "absolute", top: -40, left: `${(i * 5.2) % 100}%`,
          fontSize: 28, animation: `poop-fall ${2 + (i%4)}s linear infinite`,
          animationDelay: `${(i*0.15) % 3}s`, zIndex: 7,
        }}>{emojis[i % emojis.length]}</div>
      ))}
      <style>{`
        @keyframes crowd-pulse { 0%,100% { transform: scale(1); } 50% { transform: scale(1.1); } }
      `}</style>
    </>
  );
}
