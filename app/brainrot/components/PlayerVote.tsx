"use client";

import { useEffect, useState } from "react";
import { supabase, GAME_ID } from "@/lib/supabase";
import { Card, SectionLabel, Input, Button } from "./Card";

interface Vote { id: string; question: string; yes_count: number; no_count: number; active: boolean; ends_at: string; }

export default function PlayerVote() {
  const [question, setQuestion] = useState("");
  const [vote, setVote] = useState<Vote | null>(null);
  const [closed, setClosed] = useState<Vote | null>(null);

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase.from("active_votes").select("*")
        .eq("game_id", GAME_ID).eq("active", true)
        .order("started_at", { ascending: false })
        .limit(1).maybeSingle();
      if (data) setVote(data);
    }
    fetch();

    const sub = supabase.channel("votes")
      .on("postgres_changes", { event: "*", schema: "public", table: "active_votes" }, (payload) => {
        const row = payload.new as Vote;
        if (row?.active) setVote(row);
      })
      .subscribe();
    return () => { supabase.removeChannel(sub); };
  }, []);

  useEffect(() => {
    if (!vote) return;
    const interval = setInterval(async () => {
      if (new Date(vote.ends_at).getTime() < Date.now()) {
        await supabase.from("active_votes").update({ active: false }).eq("id", vote.id);
        setClosed(vote);
        setVote(null);
        setTimeout(() => setClosed(null), 6000);
      }
    }, 1000);
    return () => clearInterval(interval);
  }, [vote]);

  const launch = async () => {
    if (!question.trim()) return;
    const endsAt = new Date(Date.now() + 30000).toISOString();
    const { data } = await supabase.from("active_votes")
      .insert({ game_id: GAME_ID, question, active: true, ends_at: endsAt })
      .select().single();
    if (data) { setVote(data); setQuestion(""); }
  };

  const total = vote ? vote.yes_count + vote.no_count : 0;
  const yesPct = total > 0 ? (vote!.yes_count / total) * 100 : 50;

  return (
    <Card>
      <SectionLabel>Player vote</SectionLabel>
      {!vote && !closed && (
        <>
          <Input value={question} onChange={e => setQuestion(e.target.value)}
            placeholder="Should I spawn a Strawberry Elephant skin?"
            style={{ marginBottom: 8 }} />
          <Button onClick={launch} disabled={!question.trim()} style={{ width: "100%" }}>🗳 Launch Vote</Button>
        </>
      )}
      {vote && (
        <>
          <div style={{ fontSize: 13, color: "#fff", marginBottom: 10 }}>{vote.question}</div>
          <div style={{ marginBottom: 8 }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: "var(--color-green)" }}>YES</span>
              <span className="font-mono" style={{ color: "#fff" }}>{vote.yes_count}</span>
            </div>
            <div style={{ height: 8, background: "var(--color-bg)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${yesPct}%`, height: "100%", background: "var(--color-green)", transition: "width 0.3s" }} />
            </div>
          </div>
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11, marginBottom: 4 }}>
              <span style={{ color: "var(--color-red)" }}>NO</span>
              <span className="font-mono" style={{ color: "#fff" }}>{vote.no_count}</span>
            </div>
            <div style={{ height: 8, background: "var(--color-bg)", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${100 - yesPct}%`, height: "100%", background: "var(--color-red)", transition: "width 0.3s" }} />
            </div>
          </div>
        </>
      )}
      {closed && (
        <div style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
          Vote closed. {closed.yes_count > closed.no_count ? "YES" : "NO"} won ({closed.yes_count}–{closed.no_count})
        </div>
      )}
    </Card>
  );
}
