import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { getSessionRole, SESSION_COOKIE } from "@/lib/auth";

// Returns the role bound to the current session cookie, so client components
// can gate UI on "god" vs "admin" without re-reading the password. Middleware
// already guarantees the cookie is present and valid here, but we still verify
// the HMAC because this endpoint is the source of truth for client-side gating.
export async function GET() {
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  const role = await getSessionRole(token);
  if (!role) return NextResponse.json({ role: null }, { status: 401 });
  return NextResponse.json({ role });
}
