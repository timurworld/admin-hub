import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionRole, SESSION_COOKIE } from "@/lib/auth";
import { supabase } from "@/lib/supabase";

// Hands out the in-game admin creds (username + PIN) for the CURRENT session
// role. The role gate guarantees a TmoneyAdmin session can never receive
// emoney's PIN — preventing UI-side privilege escalation.
//
// Originally read PINs from EMONEY_PIN / TMONEY_PIN env vars, but those
// proved fragile in deploy (silent failures, scope mismatches between
// preview and prod). Now reads them from the players table at request time
// — same source of truth the game RPCs validate against, so the dashboard
// is never out of sync with what the database actually accepts.
const ROLE_TO_USERNAME: Record<"god" | "admin", string> = {
  god: "emoney",
  admin: "tmoney",
};

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const role = await getSessionRole(token);
  if (!role) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const username = ROLE_TO_USERNAME[role];
  const { data, error } = await supabase.from("players")
    .select("username, pin").ilike("username", username).maybeSingle();
  if (error) {
    return NextResponse.json({ error: `DB error: ${error.message}` }, { status: 500 });
  }
  if (!data?.pin) {
    return NextResponse.json({ error: `No player row for ${username}` }, { status: 500 });
  }
  return NextResponse.json({ username: data.username, pin: data.pin });
}
