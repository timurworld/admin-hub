"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { clearAdminPlayerCreds } from "@/lib/adminPlayerAuth";
import { useSessionRole } from "@/lib/useSessionRole";

export default function GameSelector() {
  const router = useRouter();
  const [playerCount, setPlayerCount] = useState(0);
  const [hoveredLive, setHoveredLive] = useState(false);
  const [hoveredSoon, setHoveredSoon] = useState(false);
  const { role: sessionRole, isGodAdmin: isGodSession } = useSessionRole();
  const siteUsername = sessionRole === "god" ? "EmoneyAdmin" : sessionRole === "admin" ? "TmoneyAdmin" : "—";

  useEffect(() => {
    async function fetchCount() {
      const { count } = await supabase.from("leaderboard").select("*", { count: "exact", head: true });
      setPlayerCount(count || 0);
    }
    fetchCount();
    const interval = setInterval(fetchCount, 10000);
    return () => clearInterval(interval);
  }, []);

  // Switch Admin: only god (EmoneyAdmin) sessions can use this. Logs out and
  // bounces to /login so the operator can sign in as TmoneyAdmin (or back as
  // EmoneyAdmin). Cached in-game creds are wiped so the next session fetches
  // its own from /api/admin-creds.
  const switchAdmin = async () => {
    clearAdminPlayerCreds();
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  return (
    <div style={{ minHeight: "100vh", background: "var(--color-bg)" }}>
      {/* Top bar */}
      <header style={{
        background: "var(--color-surface)", borderBottom: "1px solid var(--color-border)",
        padding: "16px 32px", display: "flex", justifyContent: "space-between", alignItems: "center",
      }}>
        <div>
          <div className="font-heading" style={{ fontSize: 22, color: "#fff" }}>👑 Timur Studio Admin</div>
          <div style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-jetbrains)" }}>admin.timur.world</div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, var(--color-purple), var(--color-blue))",
            display: "flex", alignItems: "center", justifyContent: "center",
            fontWeight: 700, fontSize: 13, color: "#fff",
          }}>{siteUsername.charAt(0).toUpperCase()}</div>
          <span className="font-mono" style={{
            display: "flex", alignItems: "center", gap: 6,
            marginLeft: 4, padding: "6px 10px", borderRadius: 8,
            background: "var(--color-card)",
            border: `1px solid ${isGodSession ? "rgba(255,77,77,0.5)" : "var(--color-border)"}`,
            color: "#fff", fontSize: 12,
          }}>
            <span style={{ fontSize: 13 }}>{isGodSession ? "👑" : "🛡️"}</span>
            {siteUsername}
          </span>
          {isGodSession && (
            <button onClick={switchAdmin} title="Log out and return to the login screen so you can sign in as the other admin." style={{
              marginLeft: 4, padding: "6px 12px", borderRadius: 8, background: "transparent",
              border: "1px solid var(--color-border)", color: "var(--color-text-muted)",
              cursor: "pointer", fontSize: 12,
            }}>Switch admin</button>
          )}
          <button onClick={async () => {
            await fetch("/api/auth/logout", { method: "POST" });
            window.location.href = "/login";
          }} style={{
            marginLeft: 4, padding: "6px 12px", borderRadius: 8, background: "transparent",
            border: "1px solid var(--color-border)", color: "var(--color-text-muted)",
            cursor: "pointer", fontSize: 12,
          }}>Log out</button>
        </div>
      </header>

      {/* Body */}
      <main style={{ maxWidth: 1200, margin: "0 auto", padding: "48px 32px" }}>
        <h1 className="font-heading" style={{ fontSize: 48, color: "#fff", marginBottom: 8 }}>Hey {sessionRole === "god" ? "Emoney" : sessionRole === "admin" ? "Tmoney" : "there"} 👋</h1>
        <p style={{ fontSize: 16, color: "var(--color-text-muted)", marginBottom: 40 }}>
          Pick a game to manage — run events, give skins, control the chaos.
        </p>

        <div className="font-heading btn-upper" style={{ fontSize: 12, color: "var(--color-text-muted)", marginBottom: 16 }}>
          Your games
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 20 }}>
          {/* Brainrot Clicker LIVE */}
          <div
            onClick={() => router.push("/brainrot")}
            onMouseEnter={() => setHoveredLive(true)}
            onMouseLeave={() => setHoveredLive(false)}
            style={{
              background: "var(--color-card)",
              border: `1px solid ${hoveredLive ? "var(--color-green)" : "var(--color-border)"}`,
              borderRadius: 16, padding: 24, cursor: "pointer",
              position: "relative", overflow: "hidden",
              transition: "all 0.25s ease",
              boxShadow: hoveredLive ? "0 0 40px rgba(0,232,122,0.15)" : "none",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 12, overflow: "hidden",
                background: "rgba(162,89,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center",
              }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="https://timur.world/characters/01_noobini_lovini.png" alt="Brainrot"
                  style={{ maxWidth: "90%", maxHeight: "90%", objectFit: "contain" }} />
              </div>
              <div style={{
                display: "flex", alignItems: "center", gap: 6,
                padding: "4px 10px", borderRadius: 999,
                background: "rgba(0,232,122,0.15)", border: "1px solid rgba(0,232,122,0.3)",
              }}>
                <span className="pulse-dot" style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--color-green)", display: "inline-block" }} />
                <span className="font-heading btn-upper" style={{ fontSize: 10, color: "var(--color-green)" }}>Live</span>
              </div>
            </div>

            <h3 className="font-heading" style={{ fontSize: 22, color: "#fff", marginBottom: 6 }}>Brainrot Clicker</h3>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
              Tap to collect coins, unlock characters, run Admin Abuse events live.
            </p>

            <div style={{ display: "flex", gap: 16, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
              <div>
                <div className="font-mono" style={{ fontSize: 16, color: "var(--color-green)" }}>{playerCount}</div>
                <div className="font-heading btn-upper" style={{ fontSize: 9, color: "var(--color-text-muted)" }}>Players</div>
              </div>
              <div>
                <div className="font-mono" style={{ fontSize: 16, color: "#fff" }}>15</div>
                <div className="font-heading btn-upper" style={{ fontSize: 9, color: "var(--color-text-muted)" }}>Characters</div>
              </div>
              <div>
                <div className="font-mono" style={{ fontSize: 16, color: "#fff" }}>V1</div>
                <div className="font-heading btn-upper" style={{ fontSize: 9, color: "var(--color-text-muted)" }}>Version</div>
              </div>
            </div>

            <div style={{
              position: "absolute", left: 0, right: 0, bottom: 0,
              background: "linear-gradient(180deg, transparent, var(--color-green))",
              padding: "20px 24px 14px", textAlign: "center",
              transform: hoveredLive ? "translateY(0)" : "translateY(100%)",
              transition: "transform 0.3s ease",
              color: "#000",
            }}>
              <span className="font-heading btn-upper" style={{ fontSize: 12 }}>→ Open Admin Panel</span>
            </div>
          </div>

          {/* Game 2 Coming Soon */}
          <div
            onMouseEnter={() => setHoveredSoon(true)}
            onMouseLeave={() => setHoveredSoon(false)}
            style={{
              background: "var(--color-card)",
              border: "1px solid var(--color-border)",
              borderRadius: 16, padding: 24, cursor: "not-allowed",
              position: "relative", overflow: "hidden",
              opacity: 0.6,
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div style={{
                width: 64, height: 64, borderRadius: 12,
                background: "rgba(74,158,255,0.08)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 36,
              }}>🎮</div>
              <div style={{
                padding: "4px 10px", borderRadius: 999,
                background: "rgba(74,158,255,0.15)", border: "1px solid rgba(74,158,255,0.3)",
              }}>
                <span className="font-heading btn-upper" style={{ fontSize: 10, color: "var(--color-blue)" }}>Coming Soon</span>
              </div>
            </div>

            <h3 className="font-heading" style={{ fontSize: 22, color: "var(--color-text-muted)", marginBottom: 6 }}>Game 2</h3>
            <p style={{ fontSize: 13, color: "var(--color-text-muted)", lineHeight: 1.5, marginBottom: 16 }}>
              Timur&apos;s next game. Build it, connect it, manage it from here.
            </p>

            <div style={{ display: "flex", gap: 16, paddingTop: 12, borderTop: "1px solid var(--color-border)" }}>
              {[1,2,3].map(i => (
                <div key={i}>
                  <div className="font-mono" style={{ fontSize: 16, color: "var(--color-text-muted)" }}>—</div>
                  <div className="font-heading btn-upper" style={{ fontSize: 9, color: "var(--color-text-muted)" }}>{["Players","Characters","Version"][i-1]}</div>
                </div>
              ))}
            </div>

            <div style={{
              position: "absolute", left: 0, right: 0, bottom: 0,
              background: "linear-gradient(180deg, transparent, var(--color-border))",
              padding: "20px 24px 14px", textAlign: "center",
              transform: hoveredSoon ? "translateY(0)" : "translateY(100%)",
              transition: "transform 0.3s ease",
              color: "var(--color-text-muted)",
            }}>
              <span className="font-heading btn-upper" style={{ fontSize: 12 }}>🔒 Not Built Yet</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
