import Link from "next/link";

export default function NotFound() {
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
          fontSize: "6rem",
          fontWeight: 900,
          background:
            "linear-gradient(135deg, #e0e7ff 0%, #c4b5fd 40%, #a78bfa 70%, #818cf8 100%)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
          lineHeight: 1,
          marginBottom: "16px",
        }}
      >
        404
      </div>
      <h2
        style={{
          fontSize: "1.5rem",
          fontWeight: 700,
          color: "#f1f5f9",
          marginBottom: "8px",
        }}
      >
        الصفحة غير موجودة
      </h2>
      <p
        style={{
          color: "#64748b",
          marginBottom: "24px",
          textAlign: "center",
          maxWidth: "400px",
        }}
      >
        عذراً، الصفحة التي تبحث عنها غير موجودة أو تم نقلها.
      </p>
      <Link
        href="/"
        style={{
          padding: "12px 24px",
          borderRadius: "8px",
          background: "#7c3aed",
          color: "white",
          textDecoration: "none",
          fontSize: "14px",
          fontWeight: 600,
          transition: "background 0.2s",
        }}
      >
        العودة للرئيسية
      </Link>
    </div>
  );
}
