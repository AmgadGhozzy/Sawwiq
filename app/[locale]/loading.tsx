export default function Loading() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        background: "#09090b",
      }}
    >
      <div
        style={{
          width: "48px",
          height: "48px",
          border: "3px solid rgba(124, 58, 237, 0.2)",
          borderTopColor: "#7c3aed",
          borderRadius: "50%",
          animation: "spin 1s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <p
        style={{
          marginTop: "16px",
          color: "#64748b",
          fontSize: "14px",
          fontWeight: 500,
        }}
      >
        جاري التحميل...
      </p>
    </div>
  );
}
