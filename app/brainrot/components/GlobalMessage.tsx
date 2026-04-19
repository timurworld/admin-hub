"use client";

import { useState } from "react";
import { supabase, GAME_ID } from "@/lib/supabase";
import { Card, SectionLabel, Textarea, Button } from "./Card";

export default function GlobalMessage() {
  const [msg, setMsg] = useState("");
  const [sent, setSent] = useState(false);

  const send = async () => {
    if (!msg.trim()) return;
    await supabase.from("global_messages").insert({ game_id: GAME_ID, message: msg });
    setMsg("");
    setSent(true);
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <Card>
      <SectionLabel>Broadcast</SectionLabel>
      <Textarea value={msg} onChange={e => setMsg(e.target.value)}
        placeholder="ADMIN ABUSE IN 5 MIN! 🔥"
        style={{ marginBottom: 8 }} />
      <Button onClick={send} disabled={!msg.trim()} style={{ width: "100%", background: "var(--color-blue)" }}>
        📢 Send to all players
      </Button>
      {sent && (
        <div style={{ marginTop: 8, fontSize: 12, color: "var(--color-green)" }}>
          ✓ Sent to all players
        </div>
      )}
    </Card>
  );
}
