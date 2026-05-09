import { useState, useEffect, useCallback } from "react";
import "./App.css";

// ─── Supabase config ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://dtnrkerxtjpjfomtotcs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bnJrZXJ4dGpwamZvbXRvdGNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzUzNDIsImV4cCI6MjA5MzgxMTM0Mn0.0bfZaNIOTUcM8EfTwUR-gbESwYkMFBnFj0Kc1NHOUEo";

const db = {
  get: async (table, params = "") => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${params}`, {
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" }
    });
    return res.json();
  },
  post: async (table, body) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
    return res.json();
  },
  patch: async (table, match, body) => {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
      method: "PATCH",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(body)
    });
    return res.json();
  },
  delete: async (table, match) => {
    await fetch(`${SUPABASE_URL}/rest/v1/${table}?${match}`, {
      method: "DELETE",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` }
    });
  }
};

// ─── Helpers ──────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().split("T")[0];
const dayOfDate = (d) => {
  const day = new Date(d + "T12:00:00").getDay();
  return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day];
};

// Date Seq: only populated when same person+date+job has 2+ entries
const computeSeq = (entries) => {
  const totals = {};
  entries.forEach(e => { const k = `${e.employee_id}|${e.date}|${e.job}`; totals[k] = (totals[k] || 0) + 1; });
  const counts = {};
  return entries.map(e => {
    const k = `${e.employee_id}|${e.date}|${e.job}`;
    counts[k] = (counts[k] || 0) + 1;
    return { ...e, dateSeq: totals[k] > 1 ? counts[k] : "" };
  });
};

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return <div className={`toast${type === "error" ? " error" : ""}`}>{msg}</div>;
}

// ─── Spinner ──────────────────────────────────────────────────────────────────
function Spinner() {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: 60 }}>
      <div style={{ width: 32, height: 32, border: "3px solid #e4e7f0", borderTop: "3px solid #c8a84b", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin }) {
  const [empId, setEmpId]       = useState("");
  const [empName, setEmpName]   = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const query = empId
        ? `id=eq.${encodeURIComponent(empId.trim())}`
        : `name=ilike.${encodeURIComponent(empName.trim())}`;
      const rows = await db.get("employees", query);
      if (!rows || rows.length === 0) { setError("Employee not found."); return; }
      const emp = rows[0];
      if (emp.password !== password) { setError("Incorrect password."); return; }
      // Auto-fill the other field
      onLogin({ id: emp.id, name: emp.name, role: emp.role, supervisor: emp.supervisor });
    } catch { setError("Connection error. Please try again."); }
    finally { setLoading(false); }
  };

  const handleIdBlur = async () => {
    if (!empId.trim()) return;
    const rows = await db.get("employees", `id=eq.${encodeURIComponent(empId.trim())}`);
    if (rows?.[0]) setEmpName(rows[0].name);
  };
  const handleNameBlur = async () => {
    if (!empName.trim()) return;
    const rows = await db.get("employees", `name=ilike.${encodeURIComponent(empName.trim())}`);
    if (rows?.[0]) setEmpId(rows[0].id);
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="login-logo">Eurospec <span>Tooling</span></div>
        <div className="login-sub">WEEKLY TIME SHEET SYSTEM</div>
        <div className="login-title">Sign In</div>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">Employee ID</label>
          <input className="form-input" placeholder="e.g. E001" value={empId}
            onChange={e => setEmpId(e.target.value)} onBlur={handleIdBlur} />
        </div>
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">— or — Employee Name</label>
          <input className="form-input" placeholder="e.g. Marcus Webb" value={empName}
            onChange={e => setEmpName(e.target.value)} onBlur={handleNameBlur} />
        </div>
        <div className="form-group" style={{ marginBottom: 24 }}>
          <label className="form-label">Password</label>
          <input className="form-input" type="password" placeholder="••••••••" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()} />
        </div>
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={submit} disabled={loading}>
          {loading ? "Signing in..." : "Sign In →"}
        </button>
        <div style={{ marginTop: 24, padding: "14px 16px", background: "#f8f9fc", borderRadius: 6, border: "1px solid #e4e7f0" }}>
          <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, letterSpacing: 2, textTransform: "uppercase", color: "#9aa0b4", marginBottom: 10 }}>Demo Logins</div>
          {[
            { label: "Toolmaker",  id: "E001", pw: "pass1" },
            { label: "Supervisor", id: "S001", pw: "sup1"  },
            { label: "Finance",    id: "F001", pw: "fin1"  },
            { label: "Admin",      id: "A001", pw: "admin" },
          ].map(d => (
            <div key={d.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: 12, color: "#7a8099" }}>{d.label}</span>
              <button onClick={() => { setEmpId(d.id); setEmpName(""); setPassword(d.pw); }}
                style={{ fontSize: 11, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 1,
                  background: "transparent", border: "1px solid #d8dce8", color: "#9aa0b4",
                  padding: "2px 10px", borderRadius: 3, cursor: "pointer" }}>
                {d.id} / {d.pw}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── TOOLMAKER FORM ───────────────────────────────────────────────────────────
function ToolmakerForm({ user, showToast }) {
  const [date, setDate]         = useState(today());
  const [jobs, setJobs]         = useState([{ id: uid(), job: "", hours: "", rnd: false, comment: "" }]);
  const [projectCodes, setPCs]  = useState([]);
  const [myEntries, setMine]    = useState([]);
  const [loading, setLoading]   = useState(false);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    db.get("project_codes", "order=code.asc").then(setPCs);
    db.get("entries", `employee_id=eq.${user.id}&order=created_at.desc&limit=20`).then(setMine);
  }, [user.id]);

  const addRow    = () => setJobs(j => [...j, { id: uid(), job: "", hours: "", rnd: false, comment: "" }]);
  const removeRow = (id) => setJobs(j => j.filter(r => r.id !== id));
  const updateRow = (id, field, val) => setJobs(j => j.map(r => r.id === id ? { ...r, [field]: val } : r));

  const totalHrs = jobs.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const rndHrs   = jobs.filter(r => r.rnd).reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const regHrs   = totalHrs - rndHrs;

  const submit = async () => {
    if (!date) return;
    const valid = jobs.filter(r => r.job.trim() && r.hours);
    if (!valid.length) return;
    setSaving(true);
    try {
      for (const r of valid) {
        const entry = {
          id: uid(), employee_id: user.id, employee_name: user.name,
          date, day: dayOfDate(date), job: r.job.trim(),
          hours: parseFloat(r.hours), rnd: r.rnd,
          status: "pending", supervisor_id: user.supervisor, notes: r.comment || ""
        };
        await db.post("entries", entry);
      }
      showToast("Entry submitted — awaiting supervisor approval.");
      setJobs([{ id: uid(), job: "", hours: "", rnd: false, comment: "" }]);
      const updated = await db.get("entries", `employee_id=eq.${user.id}&order=created_at.desc&limit=20`);
      setMine(updated);
    } catch { showToast("Failed to submit. Please try again.", "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="page">
      <div className="page-title">Log Time</div>
      <div className="page-sub">Enter your hours — supervisor will review and approve</div>

      <div className="card">
        <div className="card-title">New Entry</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Day</label>
            <div style={{ padding: "10px 12px", background: "#f8f9fc", border: "1px solid #e4e7f0", borderRadius: 4, color: "#c8a84b", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1 }}>
              {date ? dayOfDate(date) : "—"}
            </div>
          </div>
        </div>

        <div className="card-title" style={{ marginTop: 8 }}>Jobs & Hours</div>
        <div className="job-rows">
          {jobs.map((row) => (
            <div key={row.id} style={{
              background: row.rnd ? "#f0faf0" : "#f8f9fc",
              border: `1px solid ${row.rnd ? "#c0e0c0" : "#e4e7f0"}`,
              borderRadius: 6, padding: "12px 14px", transition: "background .2s, border-color .2s",
            }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 100px auto 28px", gap: 10, alignItems: "center" }}>
                <div>
                  <input
                    className="form-input"
                    placeholder="Type project code..."
                    value={row.job}
                    onChange={e => updateRow(row.id, "job", e.target.value)}
                    autoComplete="off"
                    list={`pc-${row.id}`}
                  />
                  <datalist id={`pc-${row.id}`}>
                    {projectCodes.map(p => (
                      <option key={p.code} value={p.code}>{p.code}{p.description ? ` — ${p.description}` : ""}</option>
                    ))}
                  </datalist>
                </div>
                <input className="form-input" type="number" min="0.25" max="24" step="0.25"
                  placeholder="Hrs" value={row.hours} onChange={e => updateRow(row.id, "hours", e.target.value)} />
                <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none" }}>
                  <input type="checkbox" checked={row.rnd} onChange={e => updateRow(row.id, "rnd", e.target.checked)}
                    style={{ accentColor: "#2a8a2a", width: 15, height: 15 }} />
                  <span style={{
                    fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1.5,
                    padding: "2px 8px", borderRadius: 3, transition: "all .2s", whiteSpace: "nowrap",
                    background: row.rnd ? "#eaf5ea" : "#f0f2f5",
                    color: row.rnd ? "#2a8a2a" : "#c4c8d4",
                    border: `1px solid ${row.rnd ? "#c0e0c0" : "#e4e7f0"}`,
                  }}>R&D</span>
                </label>
                {jobs.length > 1 ? <button className="btn-icon" onClick={() => removeRow(row.id)}>✕</button> : <span />}
              </div>
              <input className="form-input" placeholder="Comment (optional)..."
                value={row.comment} onChange={e => updateRow(row.id, "comment", e.target.value)}
                style={{ marginTop: 8, fontSize: 13, color: "#9aa0b4", background: "transparent", borderColor: "#e4e7f0" }} />
            </div>
          ))}
        </div>
        <button className="btn-add" onClick={addRow}>+ Add Another Job</button>

        <div style={{ marginTop: 16, background: "#f8f9fc", border: "1px solid #e4e7f0", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
            {[["Regular Hrs", regHrs, "#c8a84b"], ["R&D Hrs", rndHrs, "#2a8a2a"], ["Total Hrs", totalHrs, "#1a1f2e"]].map(([label, val, color]) => (
              <div key={label} style={{ padding: "10px 14px", borderRight: label !== "Total Hrs" ? "1px solid #e4e7f0" : "none" }}>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 10, letterSpacing: 2, textTransform: "uppercase", color: "#9aa0b4", marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, fontWeight: 800, color }}>{val.toFixed(2)}</div>
              </div>
            ))}
          </div>
          {totalHrs > 0 && (
            <div style={{ height: 4, background: "#e4e7f0", display: "flex" }}>
              <div style={{ width: `${(regHrs / totalHrs * 100).toFixed(0)}%`, background: "#c8a84b", transition: "width .3s" }} />
              <div style={{ width: `${(rndHrs / totalHrs * 100).toFixed(0)}%`, background: "#2a8a2a", transition: "width .3s" }} />
            </div>
          )}
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 16 }}>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>
            {saving ? "Submitting..." : "Submit Entry →"}
          </button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">My Recent Entries</div>
        {myEntries.length === 0
          ? <div style={{ color: "#c4c8d4", fontStyle: "italic", fontSize: 13 }}>No entries yet.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Day</th><th>Project</th><th>Hrs</th><th>Type</th><th>Comment</th><th>Status</th></tr></thead>
                <tbody>
                  {myEntries.map(e => (
                    <tr key={e.id}>
                      <td>{e.date}</td><td>{e.day}</td>
                      <td style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1, color: "#1a1f2e" }}>{e.job}</td>
                      <td>{e.hours}</td>
                      <td>{e.rnd ? <span className="rnd-badge">R&D</span> : <span style={{ color: "#9aa0b4", fontSize: 11 }}>Regular</span>}</td>
                      <td style={{ color: "#9aa0b4", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes || "—"}</td>
                      <td><span className={`pill pill-${e.status}`}>{e.status}</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>
    </div>
  );
}

// ─── SUPERVISOR VIEW ──────────────────────────────────────────────────────────
function SupervisorView({ user, showToast }) {
  const [entries, setEntries] = useState([]);
  const [filter, setFilter]   = useState("pending");
  const [loading, setLoading] = useState(true);
  const [teamIds, setTeamIds] = useState([]);

  useEffect(() => {
    // Get team members
    db.get("employees", `supervisor=eq.${user.id}`).then(team => {
      setTeamIds(team.map(e => e.id));
    });
    // Fetch entries directly by supervisor_id
    db.get("entries", `supervisor_id=eq.${user.id}&order=created_at.desc`)
      .then(data => { setEntries(data); setLoading(false); });
  }, [user.id]);

  const update = async (id, status) => {
    await db.patch("entries", `id=eq.${id}`, { status });
    setEntries(prev => prev.map(e => e.id === id ? { ...e, status } : e));
    showToast(status === "approved" ? "Entry approved." : "Entry rejected.", status === "approved" ? "success" : "error");
  };

  const visible = entries.filter(e => filter === "all" || e.status === filter);
  const pending = entries.filter(e => e.status === "pending").length;

  return (
    <div className="page">
      <div className="page-title">Supervisor Review</div>
      <div className="page-sub">Review and approve timesheet entries from your team</div>
      <div className="stats-row" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {[["Pending", pending, "#c8a84b", "awaiting review"], ["Team Size", teamIds.length, "#1a1f2e", "toolmakers"], ["Total Entries", entries.length, "#1a1f2e", "all time"]].map(([label, val, color, sub]) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-val" style={{ color }}>{val}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>
      <div className="filters">
        {["pending","approved","rejected","all"].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-secondary"}`}
            onClick={() => setFilter(f)}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>
      <div className="card">
        {loading ? <Spinner /> : visible.length === 0
          ? <div style={{ color: "#c4c8d4", fontStyle: "italic", fontSize: 13 }}>No entries.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Employee</th><th>Date</th><th>Day</th><th>Project</th><th>Hrs</th><th>Type</th><th>Comment</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {visible.map(e => (
                    <tr key={e.id}>
                      <td style={{ color: "#1a1f2e" }}>{e.employee_name}</td>
                      <td>{e.date}</td><td>{e.day}</td>
                      <td style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1, color: "#1a1f2e" }}>{e.job}</td>
                      <td>{e.hours}</td>
                      <td>{e.rnd ? <span className="rnd-badge">R&D</span> : <span style={{ color: "#9aa0b4", fontSize: 11 }}>Regular</span>}</td>
                      <td style={{ color: "#9aa0b4", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes || "—"}</td>
                      <td><span className={`pill pill-${e.status}`}>{e.status}</span></td>
                      <td>
                        {e.status === "pending" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-sm btn-success" onClick={() => update(e.id, "approved")}>✓ Approve</button>
                            <button className="btn btn-sm btn-danger" onClick={() => update(e.id, "rejected")}>✕</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>
    </div>
  );
}

// ─── FINANCE DASHBOARD ────────────────────────────────────────────────────────
function FinanceDashboard() {
  const [entries, setEntries]     = useState([]);
  const [loading, setLoading]     = useState(true);
  const [fromDate, setFromDate]   = useState("");
  const [toDate, setToDate]       = useState("");
  const [empFilter, setEmpFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");

  useEffect(() => {
    db.get("entries", "status=eq.approved&order=date.asc,created_at.asc")
      .then(data => { setEntries(data); setLoading(false); });
  }, []);

  const getWeekRange = (offset = 0) => {
    const now = new Date();
    const diff = (now.getDay() === 0 ? -6 : 1 - now.getDay()) + offset * 7;
    const mon = new Date(now); mon.setDate(now.getDate() + diff);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: mon.toISOString().split("T")[0], to: sun.toISOString().split("T")[0] };
  };

  const filtered = entries.filter(e => {
    if (fromDate && e.date < fromDate) return false;
    if (toDate   && e.date > toDate)   return false;
    if (empFilter && !e.employee_name.toLowerCase().includes(empFilter.toLowerCase())) return false;
    if (jobFilter && !e.job.toLowerCase().includes(jobFilter.toLowerCase())) return false;
    return true;
  });

  const withSeq   = computeSeq(filtered);
  const totalHrs  = filtered.reduce((s, e) => s + Number(e.hours), 0);
  const rndHrs    = filtered.filter(e => e.rnd).reduce((s, e) => s + Number(e.hours), 0);
  const regHrs    = totalHrs - rndHrs;
  const jobGroups = filtered.reduce((acc, e) => { acc[e.job] = (acc[e.job] || 0) + Number(e.hours); return acc; }, {});

  const exportCSV = () => {
    const rows = [["Project Code","Date of Work","Employee Code","Date Seq","Hours Work","Project Part","Project Cost","Comment","Plant"]];
    withSeq.forEach(e => rows.push([e.job, e.date, e.employee_id, e.dateSeq, e.hours, "", e.rnd ? "RD" : "LB", e.notes || "", "PET"]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `eurospec-epicor-${fromDate || today()}-to-${toDate || today()}.csv`;
    a.click();
  };

  return (
    <div className="page">
      <div className="page-title">Finance Dashboard</div>
      <div className="page-sub">Approved entries — filter and export in Epicor format</div>

      <div className="stats-row">
        {[["Total Hours", totalHrs.toFixed(1), "#1a1f2e", "approved + filtered"],
          ["LB Hours", regHrs.toFixed(1), "#c8a84b", "regular labour"],
          ["RD Hours", rndHrs.toFixed(1), "#2a8a2a", "research & dev"],
          ["Line Items", filtered.length, "#1a1f2e", "export rows"]].map(([label, val, color, sub]) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-val" style={{ color }}>{val}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Filter & Export</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          <button className="btn btn-sm btn-secondary" onClick={() => { const r = getWeekRange(0);  setFromDate(r.from); setToDate(r.to); }}>This Week</button>
          <button className="btn btn-sm btn-secondary" onClick={() => { const r = getWeekRange(-1); setFromDate(r.from); setToDate(r.to); }}>Last Week</button>
          <button className="btn btn-sm btn-secondary" onClick={() => { setFromDate(""); setToDate(""); }}>Clear</button>
        </div>
        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label">From Date</label>
            <input className="form-input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">To Date</label>
            <input className="form-input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Employee</label>
            <input className="form-input" placeholder="Search name..." value={empFilter} onChange={e => setEmpFilter(e.target.value)} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 12, alignItems: "flex-end" }}>
          <div className="form-group" style={{ flex: 1 }}>
            <label className="form-label">Project Code</label>
            <input className="form-input" placeholder="e.g. 2161" value={jobFilter} onChange={e => setJobFilter(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={exportCSV}>↓ Export Epicor CSV ({filtered.length} rows)</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Epicor Export Preview</div>
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "#fffdf5", border: "1px solid #f0dfa0", borderRadius: 4, fontSize: 12, color: "#b8860b", fontFamily: "'Barlow Condensed', sans-serif" }}>
          Project Code · Date of Work · Employee Code · Date Seq · Hours Work · Project Part · Project Cost (LB/RD) · Comment · Plant
        </div>
        {loading ? <Spinner /> : withSeq.length === 0
          ? <div style={{ color: "#c4c8d4", fontStyle: "italic", fontSize: 13 }}>No approved entries match your filters.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Project Code</th><th>Date of Work</th><th>Emp Code</th><th>Date Seq</th><th>Hrs Work</th><th>Proj Part</th><th>Proj Cost</th><th>Comment</th><th>Plant</th></tr></thead>
                <tbody>
                  {withSeq.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#1a1f2e" }}>{e.job}</td>
                      <td>{e.date}</td>
                      <td style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "#9aa0b4" }}>{e.employee_id}</td>
                      <td style={{ textAlign: "center", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#c8a84b" }}>{e.dateSeq}</td>
                      <td>{e.hours}</td>
                      <td style={{ color: "#c4c8d4" }}>—</td>
                      <td><span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, padding: "2px 8px", borderRadius: 3, background: e.rnd ? "#eaf5ea" : "#fff8e6", color: e.rnd ? "#2a8a2a" : "#b8860b", border: `1px solid ${e.rnd ? "#c0e0c0" : "#f0dfa0"}` }}>{e.rnd ? "RD" : "LB"}</span></td>
                      <td style={{ color: "#9aa0b4", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes || "—"}</td>
                      <td style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#9aa0b4" }}>PET</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>}
      </div>
    </div>
  );
}

// ─── PROJECT CODES ────────────────────────────────────────────────────────────
function ProjectCodesManager({ showToast }) {
  const [codes, setCodes]   = useState([]);
  const [code, setCode]     = useState("");
  const [desc, setDesc]     = useState("");
  const [error, setError]   = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => { db.get("project_codes", "order=code.asc").then(d => { setCodes(d); setLoading(false); }); }, []);

  const add = async () => {
    setError("");
    if (!code.trim()) { setError("Project code is required."); return; }
    if (codes.find(p => p.code === code.trim())) { setError("Code already exists."); return; }
    await db.post("project_codes", { code: code.trim(), description: desc.trim() });
    setCodes(prev => [...prev, { code: code.trim(), description: desc.trim() }].sort((a,b) => a.code.localeCompare(b.code)));
    showToast(`Project code ${code.trim()} added.`);
    setCode(""); setDesc("");
  };

  const remove = async (c) => {
    await db.delete("project_codes", `code=eq.${c}`);
    setCodes(prev => prev.filter(p => p.code !== c));
    showToast(`Project code ${c} removed.`);
  };

  return (
    <div className="page">
      <div className="page-title">Project Codes</div>
      <div className="page-sub">Manage project codes — toolmakers type and select from this list</div>
      <div className="card">
        <div className="card-title">Add Project Code</div>
        {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Project Code</label>
            <input className="form-input" placeholder="e.g. 2267" value={code} onChange={e => setCode(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <input className="form-input" placeholder="e.g. New Mould Assembly" value={desc}
              onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={add}>+ Add Code</button>
      </div>
      <div className="card">
        <div className="card-title">Active Project Codes ({codes.length})</div>
        {loading ? <Spinner /> :
          <div className="table-wrap">
            <table>
              <thead><tr><th>Project Code</th><th>Description</th><th>Action</th></tr></thead>
              <tbody>
                {codes.map(p => (
                  <tr key={p.code}>
                    <td style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, color: "#1a1f2e", letterSpacing: 1 }}>{p.code}</td>
                    <td style={{ color: "#4a5068" }}>{p.description || "—"}</td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => remove(p.code)}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>}
      </div>
    </div>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
function AdminView({ showToast }) {
  const [employees, setEmployees] = useState([]);
  const [entries, setEntries]     = useState([]);
  const [form, setForm]           = useState({ id: "", name: "", role: "toolmaker", password: "", supervisor: "" });
  const [editing, setEditing]     = useState(null);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([
      db.get("employees", "order=id.asc"),
      db.get("entries", "select=employee_id")
    ]).then(([emps, ents]) => { setEmployees(emps); setEntries(ents); setLoading(false); });
  }, []);

  const supervisors = employees.filter(e => e.role === "supervisor");

  const save = async () => {
    setError("");
    if (!form.id || !form.name || !form.password) { setError("ID, Name, and Password are required."); return; }
    if (!editing && employees.find(e => e.id === form.id)) { setError("Employee ID already exists."); return; }
    if (editing) {
      await db.patch("employees", `id=eq.${editing}`, { name: form.name, role: form.role, password: form.password, supervisor: form.supervisor || null });
      setEmployees(prev => prev.map(e => e.id === editing ? { ...form } : e));
    } else {
      await db.post("employees", { ...form, supervisor: form.supervisor || null });
      setEmployees(prev => [...prev, { ...form }]);
    }
    showToast(editing ? "Employee updated." : "Employee added.");
    setForm({ id: "", name: "", role: "toolmaker", password: "", supervisor: "" });
    setEditing(null);
  };

  const remove = async (id) => {
    await db.delete("employees", `id=eq.${id}`);
    setEmployees(prev => prev.filter(e => e.id !== id));
    showToast("Employee removed.");
  };

  const roleColor = { toolmaker: "#c8a84b", supervisor: "#2a8a2a", finance: "#2a7a9a", admin: "#cc4444" };

  return (
    <div className="page">
      <div className="page-title">Admin Panel</div>
      <div className="page-sub">Manage employees, roles, and access</div>
      <div className="card">
        <div className="card-title">{editing ? "Edit Employee" : "Add Employee"}</div>
        {error && <div className="login-error" style={{ marginBottom: 16 }}>{error}</div>}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Employee ID</label>
            <input className="form-input" placeholder="e.g. E004" value={form.id}
              onChange={e => setForm(f => ({ ...f, id: e.target.value }))} disabled={!!editing} />
          </div>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" placeholder="First Last" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
        </div>
        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value }))}>
              <option value="toolmaker">Toolmaker</option>
              <option value="supervisor">Supervisor</option>
              <option value="finance">Finance</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="text" value={form.password}
              onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          {form.role === "toolmaker" && (
            <div className="form-group">
              <label className="form-label">Supervisor</label>
              <select className="form-select" value={form.supervisor} onChange={e => setForm(f => ({ ...f, supervisor: e.target.value }))}>
                <option value="">— Assign Supervisor —</option>
                {supervisors.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
              </select>
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 10, marginTop: 8 }}>
          <button className="btn btn-primary" onClick={save}>{editing ? "Save Changes" : "Add Employee"}</button>
          {editing && <button className="btn btn-secondary" onClick={() => { setEditing(null); setForm({ id:"",name:"",role:"toolmaker",password:"",supervisor:"" }); }}>Cancel</button>}
        </div>
      </div>
      <div className="card">
        <div className="card-title">All Employees ({employees.length})</div>
        {loading ? <Spinner /> :
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Supervisor</th><th>Entries</th><th>Action</th></tr></thead>
              <tbody>
                {employees.map(emp => {
                  const sup = employees.find(e => e.id === emp.supervisor);
                  return (
                    <tr key={emp.id}>
                      <td style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#9aa0b4" }}>{emp.id}</td>
                      <td style={{ color: "#1a1f2e" }}>{emp.name}</td>
                      <td><span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: roleColor[emp.role] || "#1a1f2e" }}>{emp.role}</span></td>
                      <td style={{ color: "#9aa0b4" }}>{sup ? sup.name : "—"}</td>
                      <td>{entries.filter(e => e.employee_id === emp.id).length}</td>
                      <td>
                        <div style={{ display: "flex", gap: 8 }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => { setForm({ ...emp, supervisor: emp.supervisor || "" }); setEditing(emp.id); }}>Edit</button>
                          <button className="btn btn-sm btn-danger" onClick={() => remove(emp.id)}>Remove</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>}
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user,  setUser]  = useState(null);
  const [tab,   setTab]   = useState(null);
  const [toast, setToast] = useState(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const tabMap = {
    toolmaker:  [{ id: "log",      label: "Log Time"      }],
    supervisor: [{ id: "review",   label: "Review"        }],
    finance:    [{ id: "finance",  label: "Dashboard"     }, { id: "projects", label: "Project Codes" }],
    admin:      [{ id: "admin",    label: "Admin"         }, { id: "finance",  label: "Finance View"  }, { id: "projects", label: "Project Codes" }],
  };

  const handleLogin = emp => { setUser(emp); setTab(tabMap[emp.role]?.[0]?.id || "log"); };

  if (!user) return <div className="app"><Login onLogin={handleLogin} /></div>;

  const roleTabs = tabMap[user.role] || [];

  return (
    <div className="app">
      <header className="header">
        <div className="header-brand">Eurospec <span>Tooling</span></div>
        <div className="header-right">
          <div className="header-user">Signed in as <strong>{user.name}</strong> · {user.id}</div>
          <button className="btn-logout" onClick={() => setUser(null)}>Sign Out</button>
        </div>
      </header>
      {roleTabs.length > 1 && (
        <nav className="nav-tabs">
          {roleTabs.map(t => (
            <button key={t.id} className={`nav-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
      )}
      {tab === "log"      && <ToolmakerForm     user={user} showToast={showToast} />}
      {tab === "review"   && <SupervisorView    user={user} showToast={showToast} />}
      {tab === "finance"  && <FinanceDashboard  showToast={showToast} />}
      {tab === "projects" && <ProjectCodesManager showToast={showToast} />}
      {tab === "admin"    && <AdminView         showToast={showToast} />}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
