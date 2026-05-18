export function Footer() {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", fontSize: 12, color: "#9aa0b4", letterSpacing: 1, borderTop: "1px solid #f0f2f5", marginTop: 16, flexWrap: "wrap", gap: 4 }}>
      <span>© {new Date().getFullYear()} Eurospec Tooling & Manufacturing. All rights reserved.</span>
      <span>EuroClock by Eurospec</span>
    </div>
  );
}
