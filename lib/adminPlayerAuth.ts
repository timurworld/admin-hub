// V2 admin RPC helper. The new V2 actions (drop_event_spawn, locker_spawn,
// wave_trigger, etc.) authenticate against the Brainrot in-game `players` row
// for username='tmoney'. We need that PIN client-side here so we can pass it
// to supabase.rpc(...). Stored in localStorage; prompt on first use.

const KEY = "brainrot_admin_player_pin";

export function getAdminPlayerPin(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(KEY);
}

export function setAdminPlayerPin(pin: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(KEY, pin);
}

export function clearAdminPlayerPin(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(KEY);
}

// Prompt the operator for their in-game tmoney PIN if we don't have it cached.
// Returns the PIN or null if cancelled.
export function ensureAdminPlayerPin(): string | null {
  const cached = getAdminPlayerPin();
  if (cached) return cached;
  const entered = typeof window !== "undefined"
    ? window.prompt("Enter your in-game Brainrot PIN (for tmoney) — saved locally for V2 admin actions:")
    : null;
  if (!entered || !entered.trim()) return null;
  setAdminPlayerPin(entered.trim());
  return entered.trim();
}

export const ADMIN_USERNAME = "tmoney";
