export function RefreshBtn({ onClick, loading }) {
  return (
    <button onClick={onClick} disabled={loading} className="refresh-btn">
      <span style={{ display: "inline-block", animation: loading ? "spin 0.8s linear infinite" : "none" }}>↻</span>
      <span className="refresh-label">{loading ? "Refreshing..." : "Refresh"}</span>
    </button>
  );
}
