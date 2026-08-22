export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "var(--color-background)",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          border: "3px solid var(--color-brand-soft)",
          borderTopColor: "var(--color-brand-primary)",
          borderRadius: "var(--radius-circle)",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p
        style={{
          marginTop: "var(--space-4)",
          color: "var(--color-foreground-secondary)",
          fontSize: "var(--text-base)",
          fontWeight: "var(--font-weight-medium)",
        }}
      >
        جاري التحميل...
      </p>
    </div>
  );
}
