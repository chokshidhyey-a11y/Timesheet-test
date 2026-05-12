import { useState, useEffect, useCallback } from "react";
import { db } from "../lib/db";
import { computeSeq, getWeekRange, getMonthRange, today } from "../lib/utils";
import { Footer } from "./shared/Footer";
import { HelpButton } from "./shared/HelpButton";
import { RefreshBtn } from "./shared/RefreshBtn";
import { Spinner } from "./shared/Spinner";

export function FinanceDashboard({ onHelp }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [empFilter, setEmpFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const data = await db.get("entries", "status=eq.approved&order=date.asc,created_at.asc");
    setEntries(data);
    if (isRefresh) setRefreshing(false); else setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter(e => {
    if (fromDate && e.date < fromDate) return false;
    if (toDate && e.date > toDate) return false;
    if (empFilter && !e.employee_name.toLowerCase().includes(empFilter.toLowerCase())) return false;
    if (jobFilter && !e.job.toLowerCase().includes(jobFilter.toLowerCase())) return false;
    return true;
  });

  const withSeq = computeSeq(filtered);
  const totalHrs = filtered.reduce((s, e) => s + Number(e.hours), 0);
  const rndHrs = filtered.filter(e => e.rnd).reduce((s, e) => s + Number(e.hours), 0);
  const regHrs = totalHrs - rndHrs;

  const exportCSV = () => {
    const rows = [["Project Code", "Date of Work", "Employee Code", "Date Seq", "Hours Work", "Project Part", "Project Cost", "Comment", "Plant"]];
    withSeq.forEach(e => rows.push([e.job, e.date, e.employee_id, e.dateSeq, e.hours, "", e.rnd ? "RD" : "LB", e.notes || "", "PET"]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `euroclock-epicor-${fromDate || today()}-to-${toDate || today()}.csv`;
    a.click();
  };

  const rangeLabel = fromDate || toDate
    ? `${fromDate || "All"} — ${toDate || today()}`
    : "All approved entries";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Finance</div>
          <div className="page-sub">Filter and export in Epicor format</div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <HelpButton onClick={onHelp} />
          <RefreshBtn onClick={() => load(true)} loading={refreshing} />
        </div>
      </div>

      <div className="stats-row">
        {[["Total", totalHrs.toFixed(1), "#1a1f2e", "hours"], ["LB", regHrs.toFixed(1), "#c8a84b", "labour"], ["RD", rndHrs.toFixed(1), "#2a8a2a", "research"], ["Rows", filtered.length, "#1a1f2e", "entries"]].map(([label, val, color, sub]) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-val" style={{ color }}>{val}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Filter & Export</div>
        <div className="quick-filters">
          <button className="btn btn-sm btn-secondary" onClick={() => { const r = getWeekRange(0); setFromDate(r.from); setToDate(r.to); }}>This Week</button>
          <button className="btn btn-sm btn-secondary" onClick={() => { const r = getWeekRange(-1); setFromDate(r.from); setToDate(r.to); }}>Last Week</button>
          <button className="btn btn-sm btn-secondary" onClick={() => { const r = getMonthRange(0); setFromDate(r.from); setToDate(r.to); }}>This Month</button>
          <button className="btn btn-sm btn-secondary" onClick={() => { const r = getMonthRange(-1); setFromDate(r.from); setToDate(r.to); }}>Last Month</button>
          <button className="btn btn-sm btn-secondary" onClick={() => { setFromDate(""); setToDate(""); }}>Clear</button>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">From Date</label>
            <input className="form-input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ fontSize: 16 }} />
          </div>
          <div className="form-group">
            <label className="form-label">To Date</label>
            <input className="form-input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ fontSize: 16 }} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Employee</label>
            <input className="form-input" placeholder="Search name..." value={empFilter} onChange={e => setEmpFilter(e.target.value)} style={{ fontSize: 16 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Project Code</label>
            <input className="form-input" placeholder="e.g. 2161" value={jobFilter} onChange={e => setJobFilter(e.target.value)} style={{ fontSize: 16 }} />
          </div>
        </div>

        <div style={{ background: "#f8f9fc", border: "1px solid #e4e7f0", borderRadius: 6, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ fontSize: 12, letterSpacing: 1, textTransform: "uppercase", color: "#6b7280", marginBottom: 4, fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700 }}>Export Summary</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px 20px", fontSize: 14, color: "#1a1f2e" }}>
            <span>📅 {rangeLabel}</span>
            <span>· {filtered.length} entries</span>
            <span>· <strong>{totalHrs.toFixed(1)} hrs</strong> total</span>
            <span style={{ color: "#c8a84b" }}>({regHrs.toFixed(1)} LB</span>
            <span style={{ color: "#2a8a2a" }}>+ {rndHrs.toFixed(1)} RD)</span>
          </div>
        </div>

        <button className="btn btn-primary" onClick={exportCSV} style={{ width: "100%", padding: "13px", fontSize: 15, marginTop: 4 }}>↓ Export Epicor CSV ({filtered.length} rows)</button>
      </div>

      <div className="card">
        <div className="card-title">Export Preview</div>
        {loading ? <Spinner /> : withSeq.length === 0
          ? <div style={{ color: "#6b7280", fontStyle: "italic", fontSize: 14 }}>No approved entries match your filters.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Code</th><th>Date</th><th>Emp</th><th>Seq</th><th>Hrs</th><th>Cost</th><th>Comment</th><th>Plant</th></tr></thead>
                <tbody>
                  {withSeq.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontWeight: 700, color: "#1a1f2e" }}>{e.job}</td>
                      <td>{e.date}</td>
                      <td style={{ color: "#6b7280" }}>{e.employee_id}</td>
                      <td style={{ textAlign: "center", fontWeight: 700, color: "#c8a84b" }}>{e.dateSeq}</td>
                      <td>{e.hours}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 6px", borderRadius: 3, background: e.rnd ? "#eaf5ea" : "#fff8e6", color: e.rnd ? "#2a8a2a" : "#b8860b", border: `1px solid ${e.rnd ? "#c0e0c0" : "#f0dfa0"}` }}>{e.rnd ? "RD" : "LB"}</span></td>
                      <td style={{ color: "#6b7280", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes || "—"}</td>
                      <td style={{ color: "#6b7280" }}>PET</td>
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
