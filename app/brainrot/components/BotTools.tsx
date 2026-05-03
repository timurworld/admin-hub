"use client";

// God-admin-only bot tools. Currently a stub — UI shell ready, driver logic
// (spawn N bots, stop all, etc.) lands in a follow-up. Visibility is gated
// in app/brainrot/page.tsx via useSessionRole().isGodAdmin so this component
// itself doesn't have to enforce — by the time it renders, the parent has
// already confirmed an EmoneyAdmin site session.

import { Card, SectionLabel, Button } from "./Card";

export default function BotTools() {
  return (
    <Card accent="rgba(255,77,77,0.45)">
      <SectionLabel>👥 Users — Extra tools only</SectionLabel>

      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        <div style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
          Admin-side bot control. Spawn / stop bots without dropping into a terminal.
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6 }}>
          <Button variant="ghost" disabled>+ Spawn 10 bots</Button>
          <Button variant="ghost" disabled>+ Spawn 30 bots</Button>
          <Button variant="ghost" disabled>+ Spawn full roster (36)</Button>
          <Button variant="ghost" disabled>⏹ Stop all bots</Button>
        </div>

        <div style={{
          fontSize: 11, color: "var(--color-text-muted)",
          padding: "8px 10px", borderRadius: 6,
          background: "var(--color-card)", border: "1px dashed var(--color-border)",
          fontStyle: "italic",
        }}>
          Driver implementation pending. Will wire up the testbots.js logic to
          run from this tab (client-side bot driver) — bots stay alive while
          this admin tab is open.
        </div>
      </div>
    </Card>
  );
}
