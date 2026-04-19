"use client";

import { useRef, useState } from "react";

const GAME_URL = "https://game.timur.world";

export default function LivePreview() {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloading, setReloading] = useState(false);

  const reload = () => {
    if (!iframeRef.current) return;
    setReloading(true);
    iframeRef.current.src = `${GAME_URL}?t=${Date.now()}`;
    setTimeout(() => setReloading(false), 500);
  };

  const openInNewTab = () => window.open(GAME_URL, "_blank");

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
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <span className="pulse-dot" style={{
            width: 8, height: 8, borderRadius: "50%", background: "var(--color-red)",
          }} />
          <span className="font-heading btn-upper" style={{ fontSize: 11, color: "var(--color-red)" }}>
            Live · Player View
          </span>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)", fontFamily: "var(--font-jetbrains)" }}>
            {GAME_URL.replace(/^https?:\/\//, "")}
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

      {/* Iframe — the real game */}
      <div style={{ flex: 1, position: "relative", background: "#000" }}>
        <iframe
          ref={iframeRef}
          src={GAME_URL}
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
        This is the real game — every action you take above appears here in real time, exactly as players see it.
      </div>
    </div>
  );
}
