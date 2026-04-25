"use client";

import { useEffect, useRef, useState } from "react";

const PROD_URL = "https://game.timur.world";
const LOCAL_URL = "http://localhost:5173";
const URL_KEY = "brainrot_preview_url_target"; // 'prod' | 'local' | 'custom'
const CUSTOM_KEY = "brainrot_preview_custom_url";

export default function LivePreview() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloading, setReloading] = useState(false);
  // Default to LOCAL when the Hub itself is on localhost — that's almost
  // always what you want during development (your local game has V2 changes,
  // prod doesn't yet).
  const [target, setTarget] = useState<"prod" | "local" | "custom">("prod");
  const [customUrl, setCustomUrl] = useState("");

  useEffect(() => {
    try {
      const savedTarget = localStorage.getItem(URL_KEY) as "prod" | "local" | "custom" | null;
      const savedCustom = localStorage.getItem(CUSTOM_KEY) || "";
      if (savedTarget) {
        setTarget(savedTarget);
      } else if (typeof window !== "undefined" && window.location.hostname === "localhost") {
        setTarget("local");
      }
      if (savedCustom) setCustomUrl(savedCustom);
    } catch {}
  }, []);

  const gameUrl = target === "prod" ? PROD_URL
    : target === "local" ? LOCAL_URL
    : (customUrl || PROD_URL);

  const setTargetPersist = (t: "prod" | "local" | "custom") => {
    setTarget(t);
    try { localStorage.setItem(URL_KEY, t); } catch {}
  };
  const setCustomPersist = (url: string) => {
    setCustomUrl(url);
    try { localStorage.setItem(CUSTOM_KEY, url); } catch {}
  };

  const reload = () => {
    if (!iframeRef.current) return;
    setReloading(true);
    iframeRef.current.src = `${gameUrl}?t=${Date.now()}`;
    setTimeout(() => setReloading(false), 500);
  };

  const openInNewTab = () => window.open(gameUrl, "_blank");

  return (
    <div style={{
      position: "absolute", inset: 20, borderRadius: 16, overflow: "hidden",
      background: "var(--color-card)",
      border: "1px solid var(--color-border)",
      display: "flex", flexDirection: "column",
    }}>
      {/* Toolbar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "10px 14px",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-border)",
        flexShrink: 0,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
          <span className="pulse-dot" style={{
            width: 8, height: 8, borderRadius: "50%", background: "var(--color-red)",
          }} />
          <span className="font-heading btn-upper" style={{ fontSize: 11, color: "var(--color-red)" }}>
            Live · Player View
          </span>
          {/* Source switcher */}
          <div style={{ display: "flex", gap: 0, borderRadius: 6, overflow: "hidden", border: "1px solid var(--color-border)" }}>
            {(["prod", "local", "custom"] as const).map(t => (
              <button key={t} onClick={() => setTargetPersist(t)} title={
                t === "prod" ? PROD_URL : t === "local" ? LOCAL_URL : "Custom URL"
              } style={{
                padding: "3px 8px", border: "none",
                background: target === t ? "var(--color-purple)" : "transparent",
                color: target === t ? "#fff" : "var(--color-text-muted)",
                fontSize: 10, cursor: "pointer", textTransform: "uppercase", letterSpacing: "0.08em",
              }}>{t}</button>
            ))}
          </div>
          {target === "custom" && (
            <input value={customUrl} onChange={e => setCustomPersist(e.target.value)}
              placeholder="http://your-url"
              style={{
                fontSize: 10, padding: "2px 6px", borderRadius: 4,
                border: "1px solid var(--color-border)", background: "var(--color-bg)",
                color: "#fff", width: 180, fontFamily: "var(--font-jetbrains)",
              }} />
          )}
          <span style={{ fontSize: 10, color: "var(--color-text-muted)", fontFamily: "var(--font-jetbrains)" }}>
            {gameUrl.replace(/^https?:\/\//, "")}
          </span>
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          <button onClick={reload} disabled={reloading} title="Reload preview"
            style={{
              padding: "5px 10px", borderRadius: 6, fontSize: 11,
              background: "transparent", border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)", cursor: reloading ? "wait" : "pointer",
            }}>
            {reloading ? "↻ …" : "↻ Reload"}
          </button>
          <button onClick={openInNewTab} title="Open in new tab"
            style={{
              padding: "5px 10px", borderRadius: 6, fontSize: 11,
              background: "transparent", border: "1px solid var(--color-border)",
              color: "var(--color-text-muted)", cursor: "pointer",
            }}>
            ↗ Open
          </button>
        </div>
      </div>

      {/* Iframe — the real game (key forces remount when target changes so
          the iframe reloads cleanly with the new URL). */}
      <div style={{ flex: 1, position: "relative", background: "#000" }}>
        <iframe
          key={gameUrl}
          ref={iframeRef}
          src={gameUrl}
          title="Brainrot Clicker — Live Player View"
          style={{ width: "100%", height: "100%", border: 0, display: "block" }}
          sandbox="allow-same-origin allow-scripts allow-forms allow-popups allow-modals"
          allow="autoplay; clipboard-read; clipboard-write"
        />
      </div>

      {/* Footer hint */}
      <div style={{
        padding: "8px 14px",
        background: "var(--color-surface)",
        borderTop: "1px solid var(--color-border)",
        fontSize: 10, color: "var(--color-text-muted)",
        textAlign: "center", flexShrink: 0,
      }}>
        {target === "local"
          ? "Pointed at your local dev game — log in as tmoney inside the iframe to see dry-run lockers/drops."
          : target === "prod"
            ? "Pointed at production. Dry-run V2 events won't appear here unless prod is on V2."
            : "Custom preview URL. Log in as tmoney inside to see admin-only events."}
      </div>
    </div>
  );
}
