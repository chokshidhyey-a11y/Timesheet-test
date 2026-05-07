import { useState, useEffect } from "react";
import "./App.css";

// ─── Helpers ─────────────────────────────────────────────────────────────────
const uid = () => Math.random().toString(36).slice(2, 9);
const today = () => new Date().toISOString().split("T")[0];
const dayOfDate = (d) => {
  const day = new Date(d + "T12:00:00").getDay();
  return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day];
};

// ─── LocalStorage helpers ─────────────────────────────────────────────────────
const LS = {
  get: (key, fallback) => { try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; } catch { return fallback; } },
  set: (key, val) => { try { localStorage.setItem(key, JSON.stringify(val)); } catch {} },
};

// ─── Seed Data ───────────────────────────────────────────────────────────────
const SEED_EMPLOYEES = [
  { id: "E001", name: "Marcus Webb",    role: "toolmaker",  password: "pass1", supervisor: "S001" },
  { id: "E002", name: "Dana Kowalski",  role: "toolmaker",  password: "pass2", supervisor: "S001" },
  { id: "E003", name: "Troy Hendricks", role: "toolmaker",  password: "pass3", supervisor: "S002" },
  { id: "S001", name: "Lena Forde",     role: "supervisor", password: "sup1",  supervisor: null   },
  { id: "S002", name: "Ray Okoro",      role: "supervisor", password: "sup2",  supervisor: null   },
  { id: "A001", name: "Admin",          role: "admin",      password: "admin", supervisor: null   },
  { id: "F001", name: "Finance",        role: "finance",    password: "fin1",  supervisor: null   },
];

const SEED_PROJECT_CODES = [
  { code: "2161", description: "Mould Base Assembly" },
  { code: "2162", description: "Cavity Insert Project" },
  { code: "2163", description: "Cooling Channel R&D" },
  { code: "2172", description: "Ejector System" },
  { code: "2174", description: "Hot Runner Install" },
  { code: "2180", description: "Surface Finish Trial" },
  { code: "2208", description: "Prototype Fixture" },
  { code: "2214", description: "Core Pin Replacement" },
];

const SEED_ENTRIES = [
  { id: "t1", employeeId: "E001", employeeName: "Marcus Webb",    date: "2026-04-28", day: "Monday",    job: "2161", hours: 6,   rnd: false, status: "approved", supervisorId: "S001", notes: "Mould base machining" },
  { id: "t2", employeeId: "E001", employeeName: "Marcus Webb",    date: "2026-04-28", day: "Monday",    job: "2161", hours: 2,   rnd: true,  status: "approved", supervisorId: "S001", notes: "Testing new toolpath" },
  { id: "t3", employeeId: "E002", employeeName: "Dana Kowalski",  date: "2026-04-29", day: "Tuesday",   job: "2162", hours: 8,   rnd: false, status: "approved", supervisorId: "S001", notes: "" },
  { id: "t4", employeeId: "E001", employeeName: "Marcus Webb",    date: "2026-04-29", day: "Tuesday",   job: "2172", hours: 4,   rnd: false, status: "approved", supervisorId: "S001", notes: "Ejector pins" },
  { id: "t5", employeeId: "E001", employeeName: "Marcus Webb",    date: "2026-04-29", day: "Tuesday",   job: "2172", hours: 4,   rnd: true,  status: "approved", supervisorId: "S001", notes: "R&D cooling channel" },
  { id: "t6", employeeId: "E003", employeeName: "Troy Hendricks", date: "2026-04-30", day: "Wednesday", job: "2174", hours: 6,   rnd: false, status: "pending",  supervisorId: "S002", notes: "" },
  { id: "t7", employeeId: "E003", employeeName: "Troy Hendricks", date: "2026-04-30", day: "Wednesday", job: "2208", hours: 2,   rnd: true,  status: "pending",  supervisorId: "S002", notes: "Prototype fixture test" },
  { id: "t8", employeeId: "E002", employeeName: "Dana Kowalski",  date: "2026-05-01", day: "Thursday",  job: "2162", hours: 7,   rnd: false, status: "pending",  supervisorId: "S001", notes: "" },
];

// ─── Date Seq: per employee + date + job, only when duplicates exist ─────────
const computeSeq = (entries) => {
  // First pass: count occurrences per key
  const totals = {};
  entries.forEach(e => {
    const key = `${e.employeeId}|${e.date}|${e.job}`;
    totals[key] = (totals[key] || 0) + 1;
  });
  // Second pass: assign seq only if total > 1
  const counts = {};
  return entries.map(e => {
    const key = `${e.employeeId}|${e.date}|${e.job}`;
    counts[key] = (counts[key] || 0) + 1;
    return { ...e, dateSeq: totals[key] > 1 ? counts[key] : "" };
  });
};

// ─── Toast ───────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return <div className={`toast${type === "error" ? " error" : ""}`}>{msg}</div>;
}

// ─── LOGIN ───────────────────────────────────────────────────────────────────
function Login({ employees, onLogin }) {
  const [empId, setEmpId]       = useState("");
  const [empName, setEmpName]   = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");

  const resolve = () => {
    if (empId)   return employees.find(e => e.id.toLowerCase()   === empId.trim().toLowerCase());
    if (empName) return employees.find(e => e.name.toLowerCase() === empName.trim().toLowerCase());
    return null;
  };
  const handleIdBlur   = () => { const e = employees.find(e => e.id.toLowerCase()   === empId.trim().toLowerCase());   if (e) setEmpName(e.name); };
  const handleNameBlur = () => { const e = employees.find(e => e.name.toLowerCase() === empName.trim().toLowerCase()); if (e) setEmpId(e.id); };

  const submit = () => {
    setError("");
    const emp = resolve();
    if (!emp) { setError("Employee not found."); return; }
    if (emp.password !== password) { setError("Incorrect password."); return; }
    onLogin(emp);
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
        <button className="btn btn-primary" style={{ width: "100%" }} onClick={submit}>Sign In →</button>
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

// ─── TOOLMAKER FORM ──────────────────────────────────────────────────────────
function ToolmakerForm({ user, entries, projectCodes, onSubmit }) {
  const [date, setDate] = useState(today());
  const [jobs, setJobs] = useState([{ id: uid(), job: "", hours: "", rnd: false, comment: "" }]);

  const addRow    = () => setJobs(j => [...j, { id: uid(), job: "", hours: "", rnd: false, comment: "" }]);
  const removeRow = (id) => setJobs(j => j.filter(r => r.id !== id));
  const updateRow = (id, field, val) => setJobs(j => j.map(r => r.id === id ? { ...r, [field]: val } : r));

  const totalHrs = jobs.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const rndHrs   = jobs.filter(r => r.rnd).reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const regHrs   = totalHrs - rndHrs;

  const submit = () => {
    if (!date) return;
    const valid = jobs.filter(r => r.job && r.hours);
    if (!valid.length) return;
    valid.forEach(r => onSubmit({
      id: uid(), employeeId: user.id, employeeName: user.name,
      date, day: dayOfDate(date), job: r.job,
      hours: parseFloat(r.hours), rnd: r.rnd,
      status: "pending", supervisorId: user.supervisor, notes: r.comment || ""
    }));
    setJobs([{ id: uid(), job: "", hours: "", rnd: false, comment: "" }]);
  };

  const myEntries = entries.filter(e => e.employeeId === user.id).slice().reverse().slice(0, 20);

  return (
    <div className="page">
      <div className="page-title">Log Time</div>
      <div className="page-sub">Select a project code and enter your hours — supervisor will review and approve</div>

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
                <div style={{ position: "relative" }}>
                  <input
                    className="form-input"
                    placeholder="Type project code..."
                    value={row.job}
                    onChange={e => updateRow(row.id, "job", e.target.value)}
                    autoComplete="off"
                    list={`pc-list-${row.id}`}
                  />
                  <datalist id={`pc-list-${row.id}`}>
                    {projectCodes
                      .filter(p => !row.job || p.code.includes(row.job) || p.description.toLowerCase().includes(row.job.toLowerCase()))
                      .map(p => (
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
                    color:      row.rnd ? "#2a8a2a" : "#c4c8d4",
                    border:     `1px solid ${row.rnd ? "#c0e0c0" : "#e4e7f0"}`,
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
          <button className="btn btn-primary" onClick={submit}>Submit Entry →</button>
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
function SupervisorView({ user, entries, employees, onUpdate }) {
  const [filter, setFilter] = useState("pending");
  const myTeam = employees.filter(e => e.supervisor === user.id).map(e => e.id);
  const visible = entries.filter(e => myTeam.includes(e.employeeId))
    .filter(e => filter === "all" || e.status === filter).slice().reverse();
  const pending = entries.filter(e => myTeam.includes(e.employeeId) && e.status === "pending").length;

  return (
    <div className="page">
      <div className="page-title">Supervisor Review</div>
      <div className="page-sub">Review and approve timesheet entries from your team</div>
      <div className="stats-row" style={{ gridTemplateColumns: "repeat(3,1fr)" }}>
        {[["Pending", pending, "#c8a84b", "awaiting review"], ["Team Size", myTeam.length, "#1a1f2e", "toolmakers"], ["Total Entries", entries.filter(e => myTeam.includes(e.employeeId)).length, "#1a1f2e", "all time"]].map(([label, val, color, sub]) => (
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
        <div className="table-wrap">
          {visible.length === 0
            ? <div style={{ color: "#c4c8d4", fontStyle: "italic", fontSize: 13 }}>No entries.</div>
            : <table>
                <thead><tr><th>Employee</th><th>Date</th><th>Day</th><th>Project</th><th>Hrs</th><th>Type</th><th>Comment</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {visible.map(e => (
                    <tr key={e.id}>
                      <td style={{ color: "#1a1f2e" }}>{e.employeeName}</td>
                      <td>{e.date}</td><td>{e.day}</td>
                      <td style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, letterSpacing: 1, color: "#1a1f2e" }}>{e.job}</td>
                      <td>{e.hours}</td>
                      <td>{e.rnd ? <span className="rnd-badge">R&D</span> : <span style={{ color: "#9aa0b4", fontSize: 11 }}>Regular</span>}</td>
                      <td style={{ color: "#9aa0b4", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes || "—"}</td>
                      <td><span className={`pill pill-${e.status}`}>{e.status}</span></td>
                      <td>
                        {e.status === "pending" && (
                          <div style={{ display: "flex", gap: 6 }}>
                            <button className="btn btn-sm btn-success" onClick={() => onUpdate(e.id, "approved")}>✓ Approve</button>
                            <button className="btn btn-sm btn-danger" onClick={() => onUpdate(e.id, "rejected")}>✕</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </div>
      </div>
    </div>
  );
}

// ─── FINANCE DASHBOARD ────────────────────────────────────────────────────────
function FinanceDashboard({ entries }) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate]     = useState("");
  const [empFilter, setEmpFilter] = useState("");
  const [jobFilter, setJobFilter] = useState("");

  const getWeekRange = (offset = 0) => {
    const now = new Date();
    const day = now.getDay();
    const diff = (day === 0 ? -6 : 1 - day) + offset * 7;
    const mon = new Date(now); mon.setDate(now.getDate() + diff);
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return { from: mon.toISOString().split("T")[0], to: sun.toISOString().split("T")[0] };
  };

  const approved = entries.filter(e => e.status === "approved");
  const filtered = approved.filter(e => {
    if (fromDate && e.date < fromDate) return false;
    if (toDate   && e.date > toDate)   return false;
    if (empFilter && !e.employeeName.toLowerCase().includes(empFilter.toLowerCase())) return false;
    if (jobFilter && !e.job.toLowerCase().includes(jobFilter.toLowerCase())) return false;
    return true;
  });

  const sorted  = filtered.slice().sort((a, b) => a.date.localeCompare(b.date) || a.employeeId.localeCompare(b.employeeId));
  const withSeq = computeSeq(sorted);

  const totalHrs  = filtered.reduce((s, e) => s + e.hours, 0);
  const rndHrs    = filtered.filter(e => e.rnd).reduce((s, e) => s + e.hours, 0);
  const regHrs    = totalHrs - rndHrs;

  const exportCSV = () => {
    const rows = [["Project Code","Date of Work","Employee Code","Date Seq","Hours Work","Project Part","Project Cost","Comment","Plant"]];
    withSeq.forEach(e => rows.push([e.job, e.date, e.employeeId, e.dateSeq, e.hours, "", e.rnd ? "RD" : "LB", e.notes || "", "PET"]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    const range = fromDate && toDate ? `${fromDate}_to_${toDate}` : today();
    a.download = `eurospec-epicor-${range}.csv`;
    a.click();
  };

  return (
    <div className="page">
      <div className="page-title">Finance Dashboard</div>
      <div className="page-sub">Approved entries only — filter by date range and export in Epicor format</div>

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
        <div style={{ marginBottom: 12, padding: "8px 12px", background: "#fffdf5", border: "1px solid #f0dfa0", borderRadius: 4, fontSize: 12, color: "#b8860b", fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 0.5 }}>
          Columns match Epicor format: Project Code · Date of Work · Employee Code · Date Seq · Hours Work · Project Part · Project Cost (LB/RD) · Comment · Plant
        </div>
        <div className="table-wrap">
          {withSeq.length === 0
            ? <div style={{ color: "#c4c8d4", fontStyle: "italic", fontSize: 13 }}>No approved entries match your filters.</div>
            : <table>
                <thead><tr>
                  <th>Project Code</th><th>Date of Work</th><th>Emp Code</th><th>Date Seq</th><th>Hrs Work</th><th>Proj Part</th><th>Proj Cost</th><th>Comment</th><th>Plant</th>
                </tr></thead>
                <tbody>
                  {withSeq.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#1a1f2e" }}>{e.job}</td>
                      <td>{e.date}</td>
                      <td style={{ fontFamily: "'Barlow Condensed', sans-serif", color: "#9aa0b4" }}>{e.employeeId}</td>
                      <td style={{ textAlign: "center", fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#c8a84b" }}>{e.dateSeq}</td>
                      <td>{e.hours}</td>
                      <td style={{ color: "#c4c8d4" }}>—</td>
                      <td>
                        <span style={{
                          fontFamily: "'Barlow Condensed', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 1,
                          padding: "2px 8px", borderRadius: 3,
                          background: e.rnd ? "#eaf5ea" : "#fff8e6",
                          color: e.rnd ? "#2a8a2a" : "#b8860b",
                          border: `1px solid ${e.rnd ? "#c0e0c0" : "#f0dfa0"}`,
                        }}>{e.rnd ? "RD" : "LB"}</span>
                      </td>
                      <td style={{ color: "#9aa0b4", maxWidth: 180, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.notes || "—"}</td>
                      <td style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, color: "#9aa0b4" }}>PET</td>
                    </tr>
                  ))}
                </tbody>
              </table>}
        </div>
      </div>
    </div>
  );
}

// ─── PROJECT CODES (Finance) ──────────────────────────────────────────────────
function ProjectCodesManager({ projectCodes, setProjectCodes }) {
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState("");

  const add = () => {
    setError("");
    if (!code.trim()) { setError("Project code is required."); return; }
    if (projectCodes.find(p => p.code === code.trim())) { setError("Code already exists."); return; }
    setProjectCodes([...projectCodes, { code: code.trim(), description: desc.trim() }]);
    setCode(""); setDesc("");
  };

  return (
    <div className="page">
      <div className="page-title">Project Codes</div>
      <div className="page-sub">Add and manage project codes — toolmakers can only select from this list</div>

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
        <div className="card-title">Active Project Codes ({projectCodes.length})</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Project Code</th><th>Description</th><th>Action</th></tr></thead>
            <tbody>
              {projectCodes.map(p => (
                <tr key={p.code}>
                  <td style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 700, fontSize: 15, color: "#1a1f2e", letterSpacing: 1 }}>{p.code}</td>
                  <td style={{ color: "#4a5068" }}>{p.description || "—"}</td>
                  <td><button className="btn btn-sm btn-danger" onClick={() => setProjectCodes(projectCodes.filter(x => x.code !== p.code))}>Remove</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── ADMIN ────────────────────────────────────────────────────────────────────
function AdminView({ employees, setEmployees, entries, projectCodes, setProjectCodes }) {
  const [form, setForm]     = useState({ id: "", name: "", role: "toolmaker", password: "", supervisor: "" });
  const [editing, setEditing] = useState(null);
  const [error, setError]   = useState("");
  const supervisors = employees.filter(e => e.role === "supervisor");

  const save = () => {
    setError("");
    if (!form.id || !form.name || !form.password) { setError("ID, Name, and Password are required."); return; }
    if (!editing && employees.find(e => e.id === form.id)) { setError("Employee ID already exists."); return; }
    if (editing) { setEmployees(employees.map(e => e.id === editing ? { ...form } : e)); }
    else { setEmployees([...employees, { ...form }]); }
    setForm({ id: "", name: "", role: "toolmaker", password: "", supervisor: "" });
    setEditing(null);
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
                    <td>{entries.filter(e => e.employeeId === emp.id).length}</td>
                    <td>
                      <div style={{ display: "flex", gap: 8 }}>
                        <button className="btn btn-sm btn-secondary" onClick={() => { setForm({ ...emp }); setEditing(emp.id); }}>Edit</button>
                        <button className="btn btn-sm btn-danger" onClick={() => setEmployees(employees.filter(e => e.id !== emp.id))}>Remove</button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [employees,    setEmp]  = useState(() => LS.get("es_employees",    SEED_EMPLOYEES));
  const [entries,      setEnt]  = useState(() => LS.get("es_entries",      SEED_ENTRIES));
  const [projectCodes, setPCs]  = useState(() => LS.get("es_projectcodes", SEED_PROJECT_CODES));

  const setEmployees    = v => { setEmp(v);  LS.set("es_employees",    v); };
  const setEntries      = v => { setEnt(v);  LS.set("es_entries",      v); };
  const setProjectCodes = v => { setPCs(v);  LS.set("es_projectcodes", v); };

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

  const handleLogin  = emp => { setUser(emp); setTab(tabMap[emp.role]?.[0]?.id || "log"); };
  const handleSubmit = entry => { const next = [...entries, entry]; setEntries(next); showToast("Entry submitted — awaiting supervisor approval."); };
  const handleUpdate = (id, status) => {
    const next = entries.map(e => e.id === id ? { ...e, status } : e);
    setEntries(next);
    showToast(status === "approved" ? "Entry approved." : "Entry rejected.", status === "approved" ? "success" : "error");
  };

  if (!user) return <div className="app"><Login employees={employees} onLogin={handleLogin} /></div>;

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

      {tab === "log"      && <ToolmakerForm    user={user} entries={entries} projectCodes={projectCodes} onSubmit={handleSubmit} />}
      {tab === "review"   && <SupervisorView   user={user} entries={entries} employees={employees} onUpdate={handleUpdate} />}
      {tab === "finance"  && <FinanceDashboard entries={entries} />}
      {tab === "projects" && <ProjectCodesManager projectCodes={projectCodes} setProjectCodes={setProjectCodes} />}
      {tab === "admin"    && <AdminView employees={employees} setEmployees={setEmployees} entries={entries} projectCodes={projectCodes} setProjectCodes={setProjectCodes} />}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
