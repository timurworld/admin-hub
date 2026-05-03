"use client";

// Generic collapsible wrapper. Open/closed state persists per-card via localStorage.
// Renders a clickable header (always visible) and folds the body when closed.
//
// Usage:
//   <CollapsibleCard id="give-skin" title="Give Skin" defaultOpen={false}>
//     <GiveSkin />
//   </CollapsibleCard>

import { useEffect, useState } from "react";

interface Props {
  id: string;                 // unique key (also the DOM id used for jumpTo)
  title: string;
  icon?: string;
  defaultOpen?: boolean;
  accent?: string;            // optional border-left accent color
  // When this flips from false → true, auto-open the card. User can still close
  // it manually afterwards. Used e.g. to auto-open Broadcast when event goes live.
  forceOpen?: boolean;
  children: React.ReactNode;
}

const KEY_PREFIX = "brainrot_admin_card_open_";

export default function CollapsibleCard({ id, title, icon, defaultOpen = true, accent, forceOpen, children }: Props) {
  const [open, setOpen] = useState(defaultOpen);

  useEffect(() => {
    try {
      const v = localStorage.getItem(KEY_PREFIX + id);
      if (v === "1") setOpen(true);
      else if (v === "0") setOpen(false);
    } catch {}
  }, [id]);

  // Auto-open when forceOpen flips true (e.g. event went live → keep Broadcast open).
  useEffect(() => {
    if (forceOpen) setOpen(true);
  }, [forceOpen]);

  const toggle = () => {
    setOpen(o => {
      const next = !o;
      try { localStorage.setItem(KEY_PREFIX + id, next ? "1" : "0"); } catch {}
      return next;
    });
  };

  // No outer frame — the inner card components (GiveCoins, SpawnLocker, etc.)
  // already render their own <Card> wrappers. The CollapsibleCard just adds a
  // header strip and folds the body. Closed state shows a compact pill.
  return (
    <div id={id}>
      <button
        type="button"
        onClick={toggle}
        style={{
          width: "100%", display: "flex", alignItems: "center", gap: 10,
          // Bigger click target — was 8/10px, now consistent 12px so the
          // whole header row reads as obviously tappable.
          padding: "12px 14px",
          background: open ? "rgba(255,255,255,0.04)" : "var(--color-card)",
          border: "1px solid var(--color-border)",
          borderLeft: accent ? `3px solid ${accent}` : "1px solid var(--color-border)",
          borderRadius: 8,
          color: "#fff", cursor: "pointer", textAlign: "left",
          fontFamily: "inherit", fontSize: 13, fontWeight: 600,
          letterSpacing: "0.04em",
          marginBottom: open ? 6 : 0,
          transition: "background 0.15s, border-color 0.15s",
        }}
        onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border-hover)"; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.borderColor = "var(--color-border)"; }}
      >
        {icon && <span style={{ fontSize: 14 }}>{icon}</span>}
        <span style={{ flex: 1 }}>{title}</span>
        <span style={{
          color: "var(--color-text-muted)", fontSize: 12,
          transition: "transform 0.18s",
          transform: open ? "rotate(0deg)" : "rotate(-90deg)",
        }}>▾</span>
      </button>
      {open && children}
    </div>
  );
}
