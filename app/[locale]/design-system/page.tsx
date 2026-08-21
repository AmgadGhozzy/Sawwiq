import { notFound } from "next/navigation";

export default function DesignSystemPreview() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  return (
    <div style={{ padding: "40px", maxWidth: "1200px", margin: "0 auto" }}>
      <h1 style={{ fontSize: "2rem", fontWeight: 800, marginBottom: "8px", color: "var(--color-foreground)" }}>
        Design System Preview
      </h1>
      <p style={{ color: "var(--color-foreground-secondary)", marginBottom: "32px" }}>
        Development preview for all semantic and brand tokens.
      </p>

      {/* Brand Tokens */}
      <section style={{ marginBottom: "48px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "16px", color: "var(--color-foreground)" }}>
          Brand Tokens
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
          {[
            "brand-primary",
            "brand-surface",
            "brand-soft",
          ].map((token) => (
            <div key={token} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "16px", background: "var(--color-surface)" }}>
              <div style={{ height: "80px", borderRadius: "var(--radius-md)", background: `var(--color-${token})`, marginBottom: "12px", boxShadow: "var(--shadow-elevated)" }} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: "14px", color: "var(--color-foreground)" }}>--color-{token}</p>
            </div>
          ))}
          {/* Brand Gradient */}
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "16px", background: "var(--color-surface)" }}>
            <div style={{ height: "80px", borderRadius: "var(--radius-md)", background: `var(--gradient-brand)`, marginBottom: "12px", boxShadow: "var(--shadow-brand)" }} />
            <p style={{ margin: 0, fontWeight: 600, fontSize: "14px", color: "var(--color-foreground)" }}>--gradient-brand</p>
          </div>
        </div>
      </section>

      {/* Semantic Tokens */}
      <section style={{ marginBottom: "48px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "16px", color: "var(--color-foreground)" }}>
          Semantic Colors
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
          {[
            "background",
            "surface",
            "border",
            "foreground",
            "foreground-secondary",
            "foreground-tertiary",
            "foreground-disabled",
          ].map((token) => (
            <div key={token} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "16px", background: "var(--color-surface)" }}>
              <div style={{ height: "80px", borderRadius: "var(--radius-md)", background: `var(--color-${token})`, marginBottom: "12px", border: "1px solid var(--color-border)" }} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: "14px", color: "var(--color-foreground)" }}>--color-{token}</p>
            </div>
          ))}
          {/* Surface Gradient */}
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "16px", background: "var(--color-surface)" }}>
            <div style={{ height: "80px", borderRadius: "var(--radius-md)", background: `var(--gradient-surface)`, marginBottom: "12px", border: "1px solid var(--color-border)" }} />
            <p style={{ margin: 0, fontWeight: 600, fontSize: "14px", color: "var(--color-foreground)" }}>--gradient-surface</p>
          </div>
        </div>
      </section>

      {/* Feedback Tokens */}
      <section style={{ marginBottom: "48px" }}>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "16px", color: "var(--color-foreground)" }}>
          Feedback Colors
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
          {[
            "success",
            "warning",
            "danger",
            "info",
          ].map((token) => (
            <div key={token} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "16px", background: "var(--color-surface)" }}>
              <div style={{ height: "80px", borderRadius: "var(--radius-md)", background: `var(--color-${token})`, marginBottom: "12px" }} />
              <p style={{ margin: 0, fontWeight: 600, fontSize: "14px", color: "var(--color-foreground)" }}>--color-{token}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Examples / Components */}
      <section>
        <h2 style={{ fontSize: "1.5rem", fontWeight: 700, marginBottom: "16px", color: "var(--color-foreground)" }}>
          Component Examples
        </h2>
        <div style={{ display: "flex", gap: "24px", flexWrap: "wrap" }}>
          {/* Brand Button */}
          <button style={{
            background: "var(--gradient-brand)",
            color: "white",
            border: "none",
            padding: "12px 24px",
            borderRadius: "var(--radius-md)",
            fontWeight: 600,
            boxShadow: "var(--shadow-brand)",
            cursor: "pointer"
          }}>
            Brand Primary Button
          </button>

          {/* Secondary Button */}
          <button style={{
            background: "var(--color-surface)",
            color: "var(--color-foreground)",
            border: "1px solid var(--color-border)",
            padding: "12px 24px",
            borderRadius: "var(--radius-md)",
            fontWeight: 600,
            boxShadow: "var(--shadow-sm)",
            cursor: "pointer"
          }}>
            Secondary Button
          </button>

          {/* Danger Button */}
          <button style={{
            background: "color-mix(in srgb, var(--color-danger) 10%, transparent)",
            color: "var(--color-danger)",
            border: "1px solid color-mix(in srgb, var(--color-danger) 25%, transparent)",
            padding: "12px 24px",
            borderRadius: "var(--radius-md)",
            fontWeight: 600,
            cursor: "pointer"
          }}>
            Danger Action
          </button>
        </div>
      </section>
    </div>
  );
}
