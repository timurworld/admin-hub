// Server-only auth helpers — uses Web Crypto so it works on Edge + Node runtimes.

export const ADMIN_USERNAME = "TmoneyAdmin";
export const ADMIN_PASSWORD = "20Tmoney16!!!";
const SESSION_SECRET = "tmoney-admin-hub-session-secret-do-not-share-7f3a";

export const SESSION_COOKIE = "admin_session";
export const SESSION_MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

const ENCODER = new TextEncoder();

async function hmacHex(message: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    "raw",
    ENCODER.encode(SESSION_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, ENCODER.encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

/** Constant-time string comparison (lengths must match). */
function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function makeSessionToken(): Promise<string> {
  return hmacHex("admin");
}

export async function isValidSession(token: string | undefined): Promise<boolean> {
  if (!token) return false;
  const expected = await makeSessionToken();
  return safeEqual(token, expected);
}

export async function isValidLogin(username: string, password: string): Promise<boolean> {
  if (typeof username !== "string" || typeof password !== "string") return false;
  if (username.length > 200 || password.length > 200) return false;
  const [u, expU, p, expP] = await Promise.all([
    hmacHex(username),
    hmacHex(ADMIN_USERNAME),
    hmacHex(password),
    hmacHex(ADMIN_PASSWORD),
  ]);
  return safeEqual(u, expU) && safeEqual(p, expP);
}
