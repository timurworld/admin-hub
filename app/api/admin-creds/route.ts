import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionRole, SESSION_COOKIE } from "@/lib/auth";

// Hands out the in-game admin creds (username + PIN) for the CURRENT session
// role. The PINs live in Vercel env vars so they never ship to the client
// bundle, and the role gate guarantees a TmoneyAdmin session can never
// receive emoney's PIN — preventing UI-side privilege escalation.
//
// Required env vars:
//   EMONEY_PIN — PIN for the in-game `emoney` player (admin_tier 2)
//   TMONEY_PIN — PIN for the in-game `tmoney` player (admin_tier 1)
//
// The in-game usernames are public so they stay hardcoded here.
const ROLE_TO_PLAYER: Record<"god" | "admin", { username: string; pinEnvVar: string }> = {
  god:   { username: "emoney", pinEnvVar: "EMONEY_PIN" },
  admin: { username: "tmoney", pinEnvVar: "TMONEY_PIN" },
};

export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const role = await getSessionRole(token);
  if (!role) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

  const mapping = ROLE_TO_PLAYER[role];
  const pin = process.env[mapping.pinEnvVar];
  if (!pin) {
    return NextResponse.json(
      { error: `Server missing ${mapping.pinEnvVar} env var` },
      { status: 500 },
    );
  }
  return NextResponse.json({ username: mapping.username, pin });
}
