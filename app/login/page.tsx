"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const from = params.get("from") || "/";

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Login failed");
        setSubmitting(false);
        return;
      }
      router.push(from);
      router.refresh();
    } catch {
      setError("Network error — try again");
      setSubmitting(false);
    }
  };

  return (
    <div style={{
      minHeight: "100vh", background: "var(--color-bg)",
      display: "flex", alignItems: "center", justifyContent: "center",
      padding: 24,
    }}>
      <div style={{
        width: "100%", maxWidth: 380,
        background: "var(--color-card)", border: "1px solid var(--color-border)",
        borderRadius: 16, padding: 32,
      }}>
        <div style={{ textAlign: "center", marginBottom: 24 }}>
          <div className="font-heading" style={{ fontSize: 28, color: "#fff" }}>👑 Timur Studio</div>
          <div style={{ fontSize: 12, color: "var(--color-text-muted)", marginTop: 4 }}>
            admin.timur.world
          </div>
        </div>

        <form onSubmit={onSubmit}>
          <div style={{ marginBottom: 14 }}>
            <label style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
              autoFocus
              required
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 8,
                background: "var(--color-bg)", border: "1px solid var(--color-border)",
                color: "var(--color-text)", fontSize: 14, outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label style={{ fontSize: 11, color: "var(--color-text-muted)", display: "block", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 8,
                background: "var(--color-bg)", border: "1px solid var(--color-border)",
                color: "var(--color-text)", fontSize: 14, outline: "none",
                fontFamily: "inherit",
              }}
            />
          </div>

          {error && (
            <div style={{
              fontSize: 12, color: "var(--color-red)",
              background: "rgba(255,74,74,0.1)", border: "1px solid rgba(255,74,74,0.3)",
              borderRadius: 6, padding: "8px 10px", marginBottom: 14,
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !username || !password}
            className="font-heading btn-upper"
            style={{
              width: "100%", padding: "12px 16px", borderRadius: 8,
              background: submitting ? "var(--color-border)" : "var(--color-purple)",
              color: "#fff", border: "none", fontSize: 13,
              cursor: submitting ? "wait" : "pointer",
              opacity: (submitting || !username || !password) ? 0.6 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {submitting ? "Signing in…" : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  );
}
