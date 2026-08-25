import { notFound } from "next/navigation";

export default function DesignSystemPreview() {
  if (process.env.NODE_ENV === "production") {
    notFound();
  }

  const spacingTokens = [1, 2, 3, 4, 5, 6, 8, 10, 12, 16];
  const radiusTokens = ["xs", "sm", "md", "lg", "xl", "2xl", "3xl", "full"];
  const typographyTokens = [
    { name: "text-2xs", varName: "var(--text-2xs)" },
    { name: "text-xs", varName: "var(--text-xs)" },
    { name: "text-sm", varName: "var(--text-sm)" },
    { name: "text-base", varName: "var(--text-base)" },
    { name: "text-md", varName: "var(--text-md)" },
    { name: "text-lg", varName: "var(--text-lg)" },
    { name: "text-xl", varName: "var(--text-xl)" },
    { name: "text-2xl", varName: "var(--text-2xl)" },
    { name: "text-3xl", varName: "var(--text-3xl)" },
    { name: "text-display", varName: "var(--text-display)" }
  ];

  return (
    <div style={{ padding: "var(--space-10)", maxWidth: "var(--container-xl)", margin: "0 auto" }}>
      <h1 style={{ fontSize: "var(--text-3xl)", fontWeight: "var(--font-weight-bold)", marginBottom: "var(--space-2)", color: "var(--color-foreground)" }}>
        Design System Preview
      </h1>
      <p style={{ color: "var(--color-foreground-secondary)", marginBottom: "var(--space-8)" }}>
        Development preview for all unified design tokens.
      </p>

      {/* Brand & Gradients */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-bold)", marginBottom: "var(--space-4)", color: "var(--color-foreground)" }}>
          Brand & Gradients
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
          {[
            { token: "brand-primary", bg: "var(--color-brand-primary)" },
            { token: "brand-hover", bg: "var(--color-brand-hover)" },
            { token: "brand-soft", bg: "var(--color-brand-soft)" },
            { token: "brand-surface", bg: "var(--color-brand-surface)" },
            { token: "brand-light", bg: "var(--color-brand-light)" },
          ].map((item) => (
            <div key={item.token} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", background: "var(--color-surface)" }}>
              <div style={{ height: "80px", borderRadius: "var(--radius-md)", background: item.bg, marginBottom: "var(--space-3)", boxShadow: "var(--shadow-sm)" }} />
              <p style={{ margin: 0, fontWeight: "var(--font-weight-semibold)", fontSize: "var(--text-base)", color: "var(--color-foreground)" }}>{item.token}</p>
            </div>
          ))}
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", background: "var(--color-surface)" }}>
            <div style={{ height: "80px", borderRadius: "var(--radius-md)", background: "var(--gradient-brand)", marginBottom: "var(--space-3)", boxShadow: "var(--shadow-brand)" }} />
            <p style={{ margin: 0, fontWeight: "var(--font-weight-semibold)", fontSize: "var(--text-base)", color: "var(--color-foreground)" }}>--gradient-brand</p>
          </div>
          <div style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", background: "var(--color-surface)" }}>
            <div style={{ height: "80px", borderRadius: "var(--radius-md)", background: "var(--gradient-headline)", marginBottom: "var(--space-3)" }} />
            <p style={{ margin: 0, fontWeight: "var(--font-weight-semibold)", fontSize: "var(--text-base)", color: "var(--color-foreground)" }}>--gradient-headline</p>
          </div>
        </div>
      </section>

      {/* Semantic Colors */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-bold)", marginBottom: "var(--space-4)", color: "var(--color-foreground)" }}>
          Semantic Colors
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
          {[
            "background",
            "surface",
            "surface-elevated",
            "border",
            "border-subtle",
            "foreground",
            "foreground-secondary",
            "foreground-tertiary",
            "foreground-disabled"
          ].map((token) => (
            <div key={token} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", background: "var(--color-surface)" }}>
              <div style={{ height: "80px", borderRadius: "var(--radius-md)", background: `var(--color-${token})`, marginBottom: "var(--space-3)", border: "1px solid var(--color-border)" }} />
              <p style={{ margin: 0, fontWeight: "var(--font-weight-semibold)", fontSize: "var(--text-base)", color: "var(--color-foreground)" }}>--color-{token}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feedback & Platforms */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-bold)", marginBottom: "var(--space-4)", color: "var(--color-foreground)" }}>
          Feedback & Platforms
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "var(--space-4)" }}>
          {[
            { name: "success", bg: "var(--color-success)" },
            { name: "warning", bg: "var(--color-warning)" },
            { name: "danger", bg: "var(--color-danger)" },
            { name: "info", bg: "var(--color-info)" },
            { name: "instagram", bg: "var(--color-instagram)" },
            { name: "tiktok", bg: "var(--color-tiktok)" },
            { name: "facebook", bg: "var(--color-facebook)" },
            { name: "linkedin", bg: "var(--color-linkedin)" },
            { name: "whatsapp", bg: "var(--color-whatsapp)" }
          ].map((item) => (
            <div key={item.name} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", background: "var(--color-surface)" }}>
              <div style={{ height: "80px", borderRadius: "var(--radius-md)", background: item.bg, marginBottom: "var(--space-3)" }} />
              <p style={{ margin: 0, fontWeight: "var(--font-weight-semibold)", fontSize: "var(--text-base)", color: "var(--color-foreground)" }}>{item.name}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Border Radius */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-bold)", marginBottom: "var(--space-4)", color: "var(--color-foreground)" }}>
          Border Radius
        </h2>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "var(--space-4)" }}>
          {radiusTokens.map((radius) => (
            <div key={radius} style={{ border: "1px solid var(--color-border)", borderRadius: "var(--radius-lg)", padding: "var(--space-4)", background: "var(--color-surface)", display: "flex", flexDirection: "column", alignItems: "center" }}>
              <div style={{ width: "80px", height: "80px", border: "2px dashed var(--color-brand-primary)", borderRadius: `var(--radius-${radius})`, marginBottom: "var(--space-3)", background: "var(--color-brand-surface)" }} />
              <p style={{ margin: 0, fontWeight: "var(--font-weight-semibold)", fontSize: "var(--text-sm)", color: "var(--color-foreground)" }}>--radius-{radius}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Spacing Scale */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-bold)", marginBottom: "var(--space-4)", color: "var(--color-foreground)" }}>
          Spacing Scale
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-2)", background: "var(--color-surface)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" }}>
          {spacingTokens.map((space) => (
            <div key={space} style={{ display: "flex", alignItems: "center", gap: "var(--space-4)" }}>
              <span style={{ width: "120px", fontSize: "var(--text-sm)", color: "var(--color-foreground-secondary)" }}>--space-{space}</span>
              <div style={{ height: "16px", background: "var(--gradient-brand)", borderRadius: "var(--radius-xs)", width: `var(--space-${space})` }} />
            </div>
          ))}
        </div>
      </section>

      {/* Typography */}
      <section style={{ marginBottom: "var(--space-12)" }}>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-bold)", marginBottom: "var(--space-4)", color: "var(--color-foreground)" }}>
          Typography Scale
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", background: "var(--color-surface)", padding: "var(--space-4)", borderRadius: "var(--radius-lg)", border: "1px solid var(--color-border)" }}>
          {typographyTokens.map((token) => (
            <div key={token.name} style={{ borderBottom: "1px solid var(--color-border)", paddingBottom: "var(--space-2)" }}>
              <p style={{ margin: 0, fontSize: "var(--text-xs)", color: "var(--color-foreground-tertiary)" }}>{token.name}</p>
              <p style={{ margin: 0, fontSize: token.varName, color: "var(--color-foreground)", fontWeight: "var(--font-weight-bold)" }}>
                سَوِّق للمحتوى الذكي والفريد
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Component Examples */}
      <section>
        <h2 style={{ fontSize: "var(--text-xl)", fontWeight: "var(--font-weight-bold)", marginBottom: "var(--space-4)", color: "var(--color-foreground)" }}>
          Component Examples
        </h2>
        <div style={{ display: "flex", gap: "var(--space-4)", flexWrap: "wrap" }}>
          <button style={{
            background: "var(--gradient-brand)",
            color: "var(--color-foreground-inverse)",
            border: "none",
            padding: "var(--space-3) var(--space-6)",
            borderRadius: "var(--radius-md)",
            fontWeight: "var(--font-weight-semibold)",
            boxShadow: "var(--shadow-brand)",
            cursor: "pointer"
          }}>
            Brand Primary Button
          </button>

          <button style={{
            background: "var(--color-surface)",
            color: "var(--color-foreground)",
            border: "1px solid var(--color-border)",
            padding: "var(--space-3) var(--space-6)",
            borderRadius: "var(--radius-md)",
            fontWeight: "var(--font-weight-semibold)",
            boxShadow: "var(--shadow-sm)",
            cursor: "pointer"
          }}>
            Secondary Button
          </button>

          <button style={{
            background: "var(--color-danger-surface)",
            color: "var(--color-danger)",
            border: "1px solid var(--color-danger-border)",
            padding: "var(--space-3) var(--space-6)",
            borderRadius: "var(--radius-md)",
            fontWeight: "var(--font-weight-semibold)",
            cursor: "pointer"
          }}>
            Danger Action
          </button>
        </div>
      </section>
    </div>
  );
}
