"use client";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#09090b",
        padding: "24px",
      }}
    >
      <div
        style={{
          width: "64px",
          height: "64px",
          borderRadius: "50%",
          background: "rgba(239, 68, 68, 0.1)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: "24px",
        }}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="#ef4444"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="12" cy="12" r="10" />
          <line x1="12" y1="8" x2="12" y2="12" />
          <line x1="12" y1="16" x2="12.01" y2="16" />
        </svg>
      </div>
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#f1f5f9",
          marginBottom: "8px",
        }}
      >
        حدث خطأ
      </h2>
      <p
        style={{
          color: "#64748b",
          marginBottom: "24px",
          textAlign: "center",
          maxWidth: "400px",
        }}
      >
        عذراً، حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.
      </p>
      <button
        onClick={reset}
        style={{
          padding: "12px 24px",
          borderRadius: "8px",
          background: "#7c3aed",
          color: "white",
          border: "none",
          fontSize: "14px",
          fontWeight: 600,
          cursor: "pointer",
          transition: "background 0.2s",
        }}
        onMouseEnter={(e) => {
          e.currentTarget.style.background = "#6d28d9";
        }}
        onMouseLeave={(e) => {
          e.currentTarget.style.background = "#7c3aed";
        }}
      >
        إعادة المحاولة
      </button>
    </div>
  );
}
