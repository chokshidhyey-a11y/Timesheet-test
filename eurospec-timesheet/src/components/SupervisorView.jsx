import { useState, useEffect, useCallback } from "react";
import { db } from "../lib/db";
import { getWeekRange, getMonthRange } from "../lib/utils";
import { Footer } from "./shared/Footer";
import { HelpButton } from "./shared/HelpButton";
import { RefreshBtn } from "./shared/RefreshBtn";
import { Spinner } from "./shared/Spinner";

export function SupervisorView({ user, showToast, onHelp }) {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teamIds, setTeamIds] = useState([]);
  const [editEntry, setEditEntry] = useState(null);
  const [rejectTarget, setRejectTarget] = useState(null);

  const setPreset = (key) => {
    if (key === "week")      { const r = getWeekRange(0);   setFromDate(r.from); setToDate(r.to); }
    else if (key === "lastweek")  { const r = getWeekRange(-1);  setFromDate(r.from); setToDate(r.to); }
    else if (key === "month")     { const r = getMonthRange(0);  setFromDate(r.from); setToDate(r.to); }
    else if (key === "lastmonth") { const r = getMonthRange(-1); setFromDate(r.from); setToDate(r.to); }
    else { setFromDate(""); setToDate(""); }
  };

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const [team, data] = await Promise.all([
      db.get("employees", `supervisor=eq.${user.id}`),
      db.get("entries", `supervisor_id=eq.${user.id}&order=created_at.desc`)
    ]);
    setTeamIds(team.map(e => e.id));
    setEntries(data);
    if (isRefresh) setRefreshing(false); else setLoading(false);
  }, [user.id]);

  useEffect(() => { load(); }, [load]);

  const update = async (id, status) => {
    await db.patch("entries", `id=eq.${id}`, { status });
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    showToast(status === "approved" ? "Entry approved." : "Entry rejected.", status === "approved" ? "success" : "error");
  };

  const saveEdit = async () => {
    if (!editEntry) return;
    await db.patch("entries", `id=eq.${editEntry.id}`, { hours: parseFloat(editEntry.hours), job: editEntry.job, notes: editEntry.notes, rnd: editEntry.rnd, status: "approved" });
    setEntries(prev => prev.map(e => e.id === editEntry.id ? { ...e, hours: parseFloat(editEntry.hours), job: editEntry.job, notes: editEntry.notes, rnd: editEntry.rnd, status: "approved" } : e));
    showToast("Entry edited and approved.");
    setEditEntry(null);
  };

  const visible = entries
    .filter(e => filter === "all" || e.status === filter)
    .filter(e => !fromDate || e.date >= fromDate)
    .filter(e => !toDate || e.date <= toDate);
  const pending = entries.filter(e => e.status === "pending").length;

  return (
    <div className="page">
      {editEntry && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 8, width: "100%", maxWidth: 480, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1f2e", marginBottom: 4 }}>Edit & Approve Entry</div>
            <div style={{ fontSize: 13, color: "#6b7280", marginBottom: 16 }}>Make corrections then approve.</div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Employee</label>
              <input className="form-input" value={editEntry.employee_name} disabled style={{ background: "#f8f9fc", color: "#6b7280" }} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Project Code</label>
                <input className="form-input" value={editEntry.job} onChange={e => setEditEntry(p => ({ ...p, job: e.target.value }))} style={{ fontSize: 16 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Hours</label>
                <input className="form-input" type="number" min="0.25" max="24" step="0.25" value={editEntry.hours} onChange={e => setEditEntry(p => ({ ...p, hours: e.target.value }))} style={{ fontSize: 16 }} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Comment</label>
              <input className="form-input" value={editEntry.notes || ""} onChange={e => setEditEntry(p => ({ ...p, notes: e.target.value }))} style={{ fontSize: 16 }} />
            </div>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, cursor: "pointer", userSelect: "none" }}>
                <input type="checkbox" checked={editEntry.rnd || false} onChange={e => setEditEntry(p => ({ ...p, rnd: e.target.checked }))} style={{ accentColor: "#2a8a2a", width: 18, height: 18 }} />
                <span style={{ fontSize: 13, fontWeight: 700, letterSpacing: 1, padding: "3px 10px", borderRadius: 3, background: editEntry.rnd ? "#eaf5ea" : "#f0f2f5", color: editEntry.rnd ? "#2a8a2a" : "#6b7280", border: `1px solid ${editEntry.rnd ? "#c0e0c0" : "#e4e7f0"}` }}>R&D</span>
                <span style={{ fontSize: 13, color: "#6b7280" }}>Mark as Research & Development</span>
              </label>
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setEditEntry(null)}>Cancel</button>
              <button className="btn btn-success" onClick={saveEdit}>✓ Save & Approve</button>
            </div>
          </div>
        </div>
      )}

      {rejectTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 8, width: "100%", maxWidth: 400, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1f2e", marginBottom: 8 }}>Reject Entry?</div>
            <div style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.6, marginBottom: 20 }}>
              You're rejecting <strong>{rejectTarget.hours} hrs</strong> on <strong>{rejectTarget.job}</strong> from <strong>{rejectTarget.employee_name}</strong> ({rejectTarget.date}). This cannot be undone.
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setRejectTarget(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ background: "#fff0f0" }} onClick={() => { update(rejectTarget.id, "rejected"); setRejectTarget(null); }}>Reject</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Review</div>
          <div className="page-sub">Approve or reject timesheet entries</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <HelpButton onClick={onHelp} />
          <RefreshBtn onClick={() => load(true)} loading={refreshing} />
        </div>
      </div>

      <div className="stats-row">
        {[["Pending", pending, "#c8a84b", "awaiting"], ["Team", teamIds.length, "#1a1f2e", "members"], ["Total", entries.length, "#1a1f2e", "entries"]].map(([label, val, color, sub]) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-val" style={{ color }}>{val}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {(() => {
        const flags = [];
        entries.filter(e => e.status === "pending").forEach(e => {
          if (Number(e.hours) > 12) flags.push({ id: e.id, msg: `${e.employee_name} logged ${e.hours} hrs on ${e.job} (${e.date}) — unusually high`, level: "warn" });
        });
        const grouped = {};
        entries.filter(e => e.status === "pending").forEach(e => {
          const k = `${e.employee_id}|${e.date}|${e.job}`;
          grouped[k] = grouped[k] || [];
          grouped[k].push(e);
        });
        Object.values(grouped).forEach(group => {
          if (group.length >= 3) flags.push({ id: group[0].id + "_dup", msg: `${group[0].employee_name} logged ${group[0].job} ${group.length}× on ${group[0].date} — possible duplicate`, level: "warn" });
        });
        const dayTotals = {};
        entries.filter(e => e.status === "pending").forEach(e => {
          const k = `${e.employee_id}|${e.date}`;
          dayTotals[k] = dayTotals[k] || { name: e.employee_name, date: e.date, total: 0 };
          dayTotals[k].total += Number(e.hours);
        });
        Object.values(dayTotals).forEach(d => {
          if (d.total > 14) flags.push({ id: `tot_${d.name}_${d.date}`, msg: `${d.name} has ${d.total} total hrs on ${d.date} — exceeds 14 hrs`, level: "error" });
        });
        if (flags.length === 0) return null;
        return (
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#cc4444", marginBottom: 8 }}>⚠ Anomalies Detected</div>
            {flags.map(f => (
              <div key={f.id} style={{ padding: "10px 14px", background: f.level === "error" ? "#fff0f0" : "#fff8e6", border: `1px solid ${f.level === "error" ? "#f0c0c0" : "#f0dfa0"}`, borderRadius: 6, marginBottom: 8, fontSize: 14, color: f.level === "error" ? "#cc4444" : "#b8860b", display: "flex", alignItems: "center", gap: 8 }}>
                <span>{f.level === "error" ? "🔴" : "🟡"}</span> {f.msg}
              </div>
            ))}
          </div>
        );
      })()}

      <div className="filters" style={{ alignItems: "flex-end", gap: 12, flexWrap: "wrap" }}>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#4b5563", marginBottom: 6 }}>Status</div>
          <div style={{ display: "flex", gap: 6 }}>
            {["pending", "approved", "rejected", "all"].map(f => (
              <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter(f)}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
            ))}
          </div>
        </div>
        <div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#4b5563", marginBottom: 6 }}>Date Range</div>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
            {[["week","This Week"],["lastweek","Last Week"],["month","This Month"],["lastmonth","Last Month"],["all","All"]].map(([k,label]) => (
              <button key={k} className="btn btn-sm btn-secondary" onClick={() => setPreset(k)}>{label}</button>
            ))}
            <input className="form-input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ fontSize: 13, padding: "6px 8px", width: 140 }} />
            <span style={{ color: "#6b7280", fontSize: 13 }}>→</span>
            <input className="form-input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ fontSize: 13, padding: "6px 8px", width: 140 }} />
          </div>
        </div>
      </div>

      <div className="card">
        {loading ? <Spinner /> : visible.length === 0
          ? <div style={{ color: "#6b7280", fontStyle: "italic", fontSize: 14 }}>No entries.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Employee</th><th>Date</th><th>Project</th><th>Hrs</th><th>Type</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {visible.map(e => (
                    <tr key={e.id}>
                      <td style={{ color: "#1a1f2e", fontWeight: 500 }}>{e.employee_name}</td>
                      <td>{e.date}</td>
                      <td style={{ fontWeight: 700, color: "#1a1f2e" }}>{e.job}</td>
                      <td>{e.hours}</td>
                      <td>{e.rnd ? <span className="rnd-badge">R&D</span> : <span style={{ color: "#6b7280", fontSize: 12 }}>Reg</span>}</td>
                      <td><span className={`pill pill-${e.status}`}>{e.status}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {e.status === "pending" && <>
                            <button className="btn btn-sm btn-success" onClick={() => update(e.id, "approved")} style={{ minHeight: 36 }}>✓</button>
                            <button className="btn btn-sm btn-danger" onClick={() => setRejectTarget(e)} style={{ minHeight: 36 }}>✕</button>
                          </>}
                          {(e.status === "pending" || e.status === "rejected") && <button className="btn btn-sm btn-secondary" onClick={() => setEditEntry({ ...e })} style={{ minHeight: 36 }}>Edit</button>}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>
      <Footer />
    </div>
  );
}
