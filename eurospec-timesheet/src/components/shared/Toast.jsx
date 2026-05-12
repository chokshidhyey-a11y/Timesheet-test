import { useEffect } from "react";

export function Toast({ msg, type, onDone }) {
  const duration = Math.max(3000, msg.length * 65);
  useEffect(() => { const t = setTimeout(onDone, duration); return () => clearTimeout(t); }, [onDone, duration]);
  return <div className={`toast${type === "error" ? " error" : ""}`}>{msg}</div>;
}
