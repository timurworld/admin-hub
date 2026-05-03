// Server-only auth helpers — uses Web Crypto so it works on Edge + Node runtimes.
//
// Two site logins, each bound to a role. The role is encoded into the
// session cookie so the rest of the app can gate UI on it without re-checking
// a password on every render.
//
//   role "god"   → EmoneyAdmin → sees God Admin section + Bot Tools + Switch User
//   role "admin" → TmoneyAdmin → regular admin tools only, no escalation path
//
// Cookie format is `<role>.<hmac(role)>`. The HMAC binds the role to our
// SESSION_SECRET so a client can't tamper with their cookie to claim "god".

export type SessionRole = "god" | "admin";

interface Account {
  password: string;
  role: SessionRole;
}

const ACCOUNTS: Record<string, Account> = {
  TmoneyAdmin: { password: "20Tmoney16!!!", role: "admin" },
  EmoneyAdmin: { password: "Mizrop7955!@#", role: "god" },
};

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

function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function makeSessionToken(role: SessionRole): Promise<string> {
  const sig = await hmacHex(role);
  return `${role}.${sig}`;
}

/** Returns the session role if the token is valid, otherwise null. */
export async function getSessionRole(token: string | undefined): Promise<SessionRole | null> {
  if (!token) return null;
  const dot = token.indexOf(".");
  if (dot <= 0) return null;
  const role = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  if (role !== "god" && role !== "admin") return null;
  const expected = await hmacHex(role);
  return safeEqual(sig, expected) ? (role as SessionRole) : null;
}

/** Truthy if the cookie carries a valid session — used by middleware. */
export async function isValidSession(token: string | undefined): Promise<boolean> {
  return (await getSessionRole(token)) !== null;
}

/** Returns the role on success (so the login route can mint the right cookie), null on failure. */
export async function isValidLogin(username: string, password: string): Promise<SessionRole | null> {
  if (typeof username !== "string" || typeof password !== "string") return null;
  if (username.length > 200 || password.length > 200) return null;

  // Walk every account so a wrong username doesn't reject faster than a wrong
  // password — keeps the surface uniform.
  let matched: SessionRole | null = null;
  for (const [acctName, acct] of Object.entries(ACCOUNTS)) {
    const [u, expU, p, expP] = await Promise.all([
      hmacHex(username),
      hmacHex(acctName),
      hmacHex(password),
      hmacHex(acct.password),
    ]);
    if (safeEqual(u, expU) && safeEqual(p, expP)) {
      matched = acct.role;
    }
  }
  return matched;
}
