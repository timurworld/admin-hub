// In-game admin creds (username + PIN) used for V2 RPCs that authenticate
// against `players.is_admin` / `players.admin_tier`.
//
// Source of truth: GET /api/admin-creds, which reads the session cookie role
// (god/admin) and returns the corresponding (username, PIN) from server-side
// env vars. This way:
//   • The PIN never lives in the client bundle.
//   • A TmoneyAdmin session can never receive emoney's PIN — privilege
//     escalation through the dashboard is impossible.
//
// We cache the response in localStorage as a memo so RPC callers can stay
// fast/sync after the first fetch. clearAdminPlayerCreds() invalidates the
// memo (used on logout and on RPC unauthorized errors).

export type AdminCreds = { username: string; pin: string };

const USERNAME_KEY = "brainrot_admin_player_username";
const PIN_KEY = "brainrot_admin_player_pin";

export function getAdminPlayerCreds(): AdminCreds | null {
  if (typeof window === "undefined") return null;
  const username = localStorage.getItem(USERNAME_KEY)?.trim();
  const pin = localStorage.getItem(PIN_KEY)?.trim();
  if (!username || !pin) return null;
  return { username, pin };
}

export function setAdminPlayerCreds(creds: AdminCreds): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(USERNAME_KEY, creds.username);
  localStorage.setItem(PIN_KEY, creds.pin);
}

export function clearAdminPlayerCreds(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(USERNAME_KEY);
  localStorage.removeItem(PIN_KEY);
}

// Returns the in-game creds bound to the current site session, fetching from
// /api/admin-creds on cache miss. Call from RPC handlers right before they
// hit Supabase. Returns null if the user isn't authenticated or the server
// is missing its env var (an alert is shown so the caller knows to bail).
export async function ensureAdminPlayerCreds(): Promise<AdminCreds | null> {
  const cached = getAdminPlayerCreds();
  if (cached) return cached;
  if (typeof window === "undefined") return null;

  try {
    const res = await fetch("/api/admin-creds", { cache: "no-store" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      window.alert(`Could not load admin creds: ${data.error || res.statusText}`);
      return null;
    }
    const creds: AdminCreds = await res.json();
    setAdminPlayerCreds(creds);
    return creds;
  } catch (err) {
    window.alert(`Could not load admin creds: ${err instanceof Error ? err.message : "network error"}`);
    return null;
  }
}
