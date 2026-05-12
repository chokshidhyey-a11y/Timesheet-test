import { useState, useEffect, useRef } from "react";

export function ProjectInput({ value, onChange, projectCodes }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState(value);
  const ref = useRef(null);

  useEffect(() => { setQuery(value); }, [value]);

  const matches = projectCodes.filter(p =>
    !query || p.code.includes(query) || (p.description || "").toLowerCase().includes(query.toLowerCase())
  );

  const select = (code) => { onChange(code); setQuery(code); setOpen(false); };

  useEffect(() => {
    const h = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener("mousedown", h);
    return () => document.removeEventListener("mousedown", h);
  }, []);

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <input
        className="form-input"
        placeholder="Type or search project code..."
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
        style={{ fontSize: 16 }}
      />
      {open && matches.length > 0 && (
        <div style={{ position: "absolute", top: "100%", left: 0, right: 0, zIndex: 200, background: "#fff", border: "1px solid #d8dce8", borderRadius: 4, boxShadow: "0 4px 12px rgba(0,0,0,0.12)", maxHeight: 240, overflowY: "auto" }}>
          {matches.slice(0, 50).map(p => (
            <div
              key={p.code}
              onMouseDown={() => select(p.code)}
              onTouchEnd={() => select(p.code)}
              style={{ padding: "12px 14px", cursor: "pointer", borderBottom: "1px solid #f0f2f5", display: "flex", gap: 10, alignItems: "center", minHeight: 44 }}
              onMouseEnter={e => e.currentTarget.style.background = "#f8f9fc"}
              onMouseLeave={e => e.currentTarget.style.background = "#fff"}
            >
              <span style={{ fontWeight: 700, color: "#1a1f2e", fontSize: 15 }}>{p.code}</span>
              {p.description && <span style={{ color: "#6b7280", fontSize: 13 }}>— {p.description}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
