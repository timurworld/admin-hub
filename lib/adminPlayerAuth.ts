// V2 admin RPC helper. The V2 actions (drop_event_spawn, locker_spawn,
// wave_trigger, etc.) authenticate against the Brainrot in-game `players`
// row via assert_admin_auth(), which now gates on the players.is_admin
// column instead of a hardcoded username (see scripts/sql/08_admin_role.sql).
// We need both the operator's in-game username AND PIN client-side here so
// we can pass them to supabase.rpc(...). Stored in localStorage; prompt on
// first use.

export type AdminCreds = { username: string; pin: string };

const USERNAME_KEY = "brainrot_admin_player_username";
const PIN_KEY = "brainrot_admin_player_pin";

export function getAdminPlayerCreds(): AdminCreds | null {
  if (typeof window === "undefined") return null;
  const username = localStorage.getItem(USERNAME_KEY)?.trim();
  const pin = localStorage.getItem(PIN_KEY)?.trim();
  if (!pin) return null;
  // Backwards compat: pre-08 admin hubs only stored the PIN (with username
  // implicitly "tmoney"). Surface those existing creds without re-prompting.
  return { username: username || "tmoney", pin };
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

// Prompt the operator for their in-game username + PIN if we don't have
// them cached. Returns the creds or null if cancelled.
export function ensureAdminPlayerCreds(): AdminCreds | null {
  const cached = getAdminPlayerCreds();
  if (cached) return cached;
  if (typeof window === "undefined") return null;
  const username = window.prompt(
    "Admin in-game username (must have is_admin=true in the players table):",
  );
  if (!username || !username.trim()) return null;
  const pin = window.prompt(`Admin PIN for ${username.trim()}:`);
  if (!pin || !pin.trim()) return null;
  const creds = { username: username.trim(), pin: pin.trim() };
  setAdminPlayerCreds(creds);
  return creds;
}

// Back-compat shims for any caller still using the pin-only API. Prefer
// ensureAdminPlayerCreds() in new code.
export function ensureAdminPlayerPin(): string | null {
  return ensureAdminPlayerCreds()?.pin ?? null;
}

export function getAdminPlayerPin(): string | null {
  return getAdminPlayerCreds()?.pin ?? null;
}

export function clearAdminPlayerPin(): void {
  clearAdminPlayerCreds();
}
