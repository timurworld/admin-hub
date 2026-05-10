"use client";

import { forwardRef } from "react";

export function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div className="font-heading btn-upper" style={{
      fontSize: 11, color: "var(--color-text-muted)", marginBottom: 8, letterSpacing: "0.12em",
    }}>{children}</div>
  );
}

export function Card({ children, accent, style }: { children: React.ReactNode; accent?: string; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "var(--color-card)",
      border: `1px solid ${accent || "var(--color-border)"}`,
      borderRadius: 12, padding: 16,
      ...style,
    }}>{children}</div>
  );
}

export const Input = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(function Input(props, ref) {
  return (
    <input ref={ref} {...props} style={{
      width: "100%", padding: "10px 12px", borderRadius: 8,
      background: "var(--color-bg)", border: "1px solid var(--color-border)",
      color: "var(--color-text)", fontSize: 13, outline: "none",
      fontFamily: "inherit",
      ...props.style,
    }} />
  );
});

export function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea {...props} style={{
      width: "100%", padding: "10px 12px", borderRadius: 8,
      background: "var(--color-bg)", border: "1px solid var(--color-border)",
      color: "var(--color-text)", fontSize: 13, outline: "none",
      fontFamily: "inherit", resize: "vertical", minHeight: 60,
      ...props.style,
    }} />
  );
}

export function Button({ children, variant = "primary", ...props }: {
  children: React.ReactNode; variant?: "primary" | "success" | "danger" | "ghost" | "disabled";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  const colors = {
    primary: { bg: "var(--color-purple)", text: "#fff" },
    success: { bg: "var(--color-green)", text: "#000" },
    danger: { bg: "var(--color-red)", text: "#fff" },
    // Ghost text is white so enabled buttons read as clearly clickable. The
    // opacity-0.5 disabled state below dims them — using muted text here
    // made enabled and disabled visually indistinguishable.
    ghost: { bg: "transparent", text: "#fff" },
    disabled: { bg: "var(--color-border)", text: "var(--color-text-muted)" },
  }[variant];
  return (
    <button {...props} className={"font-heading btn-upper " + (props.className || "")} style={{
      padding: "10px 16px", borderRadius: 8,
      background: colors.bg, color: colors.text,
      border: variant === "ghost" ? "1px solid var(--color-border)" : "none",
      cursor: props.disabled ? "not-allowed" : "pointer",
      fontSize: 12, opacity: props.disabled ? 0.5 : 1,
      transition: "transform 0.1s, opacity 0.2s",
      ...props.style,
    }}>{children}</button>
  );
}
