import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://dtnrkerxtjpjfomtotcs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bnJrZXJ4dGpwamZvbXRvdGNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzUzNDIsImV4cCI6MjA5MzgxMTM0Mn0.0bfZaNIOTUcM8EfTwUR-gbESwYkMFBnFj0Kc1NHOUEo";
const LOGO_URL    = "https://th.bing.com/th/id/R.287e4b39e66019910c6cd8fdca93e03e?rik=4sgN%2bWBn06yxMA&riu=http%3a%2f%2feurospectooling.com%2fwp-content%2fuploads%2f2011%2f07%2flogo3.png&ehk=31Z3kUJnRQ6VGbV%2f2QzOyAQA3LT1vnBCXxMM1b0xuAk%3d&risl=&pid=ImgRaw&r=0"; // ← paste your logo URL here
const INACTIVITY_MS = 10 * 60 * 1000;
const APP_NAME    = "EuroClock";
const APP_SLOGAN  = "Log it. Approve it. Export it.";
const DEV_NAME    = "Dhyey Chokshi (Software Developer)";
const DEV_EMAIL   = "dchokshi@eurospectooling.com";

// ─── Supabase ─────────────────────────────────────────────────────────────────
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
const getWeekRange = (offset = 0) => {
  const now = new Date();
  const diff = (now.getDay() === 0 ? -6 : 1 - now.getDay()) + offset * 7;
  const mon = new Date(now); mon.setDate(now.getDate() + diff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: mon.toISOString().split("T")[0], to: sun.toISOString().split("T")[0] };
};
const getMonthRange = (offset = 0) => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last  = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: first.toISOString().split("T")[0], to: last.toISOString().split("T")[0] };
};
const SESSION_KEY = "es_user";
const saveSession  = (u) => sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
const loadSession  = ()  => { try { const v = sessionStorage.getItem(SESSION_KEY); return v ? JSON.parse(v) : null; } catch { return null; } };
const clearSession = ()  => sessionStorage.removeItem(SESSION_KEY);

// ─── Shared UI ────────────────────────────────────────────────────────────────
function Toast({ msg, type, onDone }) {
  useEffect(() => { const t = setTimeout(onDone, 2800); return () => clearTimeout(t); }, [onDone]);
  return <div className={`toast${type === "error" ? " error" : ""}`}>{msg}</div>;
}
function Spinner() {
  return (
    <div style={{ display:"flex", alignItems:"center", justifyContent:"center", padding:60 }}>
      <div style={{ width:32, height:32, border:"3px solid #e4e7f0", borderTop:"3px solid #c8a84b", borderRadius:"50%", animation:"spin 0.8s linear infinite" }} />
      <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}
function RefreshBtn({ onClick, loading }) {
  return (
    <button onClick={onClick} disabled={loading} style={{ display:"flex", alignItems:"center", gap:6, background:"transparent", border:"1px solid #d8dce8", color:"#7a8099", padding:"6px 14px", borderRadius:4, cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, letterSpacing:1, textTransform:"uppercase", transition:"all .2s" }}>
      <span style={{ display:"inline-block", animation: loading ? "spin 0.8s linear infinite" : "none" }}>↻</span>
      {loading ? "Refreshing..." : "Refresh"}
    </button>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────
function Footer() {
  return (
    <div style={{ textAlign:"right", padding:"12px 32px", fontSize:11, color:"#c4c8d4", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, borderTop:"1px solid #f0f2f5", marginTop:16 }}>
      Developed by: Eurospec
    </div>
  );
}

// ─── Help Modal ───────────────────────────────────────────────────────────────
function HelpModal({ onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:10, width:"100%", maxWidth:680, maxHeight:"90vh", overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div style={{ background:"#1a1f2e", borderRadius:"10px 10px 0 0", padding:"24px 28px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:800, letterSpacing:2, color:"#c8a84b" }}>{APP_NAME} <span style={{ color:"#fff" }}>Help Center</span></div>
            <div style={{ fontSize:12, color:"#9aa0b4", marginTop:2 }}>Everything you need to know about using EuroClock</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#9aa0b4", fontSize:22, cursor:"pointer", padding:"4px 8px" }}>✕</button>
        </div>

        <div style={{ padding:"28px" }}>
          {/* Quick Start */}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#c8a84b", marginBottom:14, paddingBottom:8, borderBottom:"2px solid #f0f2f5" }}>Quick Start Guide</div>
            {[
              { role:"👷 Toolmaker / CNC", color:"#fff8e6", border:"#f0dfa0", steps:["Sign in with your Employee ID or name and password.", "Select the date and day you worked.", "Type or search for your Project Code — suggestions appear as you type.", "Enter the hours worked. Check R&D if the work qualifies.", "Add a comment if needed, then click Submit Entry.", "Toolmaker entries go to your supervisor for approval. CNC entries are auto-approved."] },
              { role:"👔 Supervisor", color:"#f0faf0", border:"#c0e0c0", steps:["Sign in and go to the Review tab.", "You'll see all pending entries from your team.", "Click ✓ Approve to approve, or ✕ to reject an entry.", "Rejected entries can be edited — click Edit on any rejected entry, adjust the hours or details, and re-approve.", "Use the Refresh button to load new entries without reloading the page."] },
              { role:"💼 Finance", color:"#f0f4ff", border:"#b0c4f0", steps:["Sign in and go to the Dashboard tab.", "Use This Week, Last Week, This Month, or Last Month buttons to filter quickly.", "Or set a custom date range and filter by employee or project code.", "The Epicor Export Preview shows exactly what will be exported.", "Click Export Epicor CSV to download the file in the correct format for bulk import.", "Go to Project Codes tab to add or remove project codes for the team."] },
              { role:"🔧 Admin", color:"#fdf0f0", border:"#f0c0c0", steps:["Sign in and go to the Admin tab.", "Add employees with their ID, name, role (Toolmaker or CNC), password, and supervisor.", "Toolmaker → requires supervisor approval. CNC → auto-approved.", "Edit or remove employees at any time.", "You also have access to Finance and Project Codes views."] },
            ].map(s => (
              <div key={s.role} style={{ marginBottom:16, background:s.color, border:`1px solid ${s.border}`, borderRadius:8, padding:"14px 18px" }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:700, letterSpacing:1, color:"#1a1f2e", marginBottom:10 }}>{s.role}</div>
                <ol style={{ paddingLeft:18, margin:0 }}>
                  {s.steps.map((step, i) => <li key={i} style={{ fontSize:13, color:"#4a5068", marginBottom:6, lineHeight:1.5 }}>{step}</li>)}
                </ol>
              </div>
            ))}
          </div>

          {/* FAQ */}
          <div style={{ marginBottom:28 }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#c8a84b", marginBottom:14, paddingBottom:8, borderBottom:"2px solid #f0f2f5" }}>Frequently Asked Questions</div>
            {[
              ["Will I get logged out if I refresh the page?", "No — EuroClock remembers your session across refreshes. You will only be logged out after 10 minutes of inactivity, or when you click Sign Out."],
              ["What is the difference between LB and RD in the export?", "LB (Labour) is regular work hours. RD (Research & Development) is for R&D work. Check the R&D checkbox when logging hours to mark them as RD."],
              ["What is Date Seq in the export?", "Date Seq is only filled in when you log multiple entries for the same project on the same day — it numbers them 1, 2, 3 so Epicor can distinguish them."],
              ["Can I log hours for a past date?", "Yes — simply change the date picker to any past date when logging your entry."],
              ["What happens when a supervisor rejects my entry?", "Your entry will show as Rejected. The supervisor can edit and re-approve it, or you can contact your supervisor directly."],
            ].map(([q, a]) => (
              <div key={q} style={{ marginBottom:12, padding:"12px 16px", background:"#f8f9fc", borderRadius:6, border:"1px solid #e4e7f0" }}>
                <div style={{ fontWeight:600, fontSize:13, color:"#1a1f2e", marginBottom:4 }}>{q}</div>
                <div style={{ fontSize:13, color:"#7a8099", lineHeight:1.5 }}>{a}</div>
              </div>
            ))}
          </div>

          {/* Contact */}
          <div style={{ background:"#1a1f2e", borderRadius:8, padding:"20px 24px" }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:14, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#c8a84b", marginBottom:14 }}>Contact Us</div>
            <div style={{ display:"flex", alignItems:"center", gap:16, flexWrap:"wrap" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"#c8a84b", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:800, fontSize:18, color:"#1a1f2e", flexShrink:0 }}>DC</div>
              <div>
                <div style={{ color:"#fff", fontWeight:600, fontSize:14 }}>{DEV_NAME}</div>
                <div style={{ color:"#9aa0b4", fontSize:13, marginTop:2 }}>EuroClock Support · Eurospec Tooling & Manufacturing</div>
                <a href={`mailto:${DEV_EMAIL}`} style={{ color:"#c8a84b", fontSize:13, marginTop:4, display:"block", textDecoration:"none" }}>📧 {DEV_EMAIL}</a>
              </div>
            </div>
            <div style={{ marginTop:16, padding:"10px 14px", background:"rgba(255,255,255,0.05)", borderRadius:6, fontSize:12, color:"#9aa0b4" }}>
              For urgent issues, email directly. For general questions about how to use EuroClock, refer to the guide above.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Help Button ──────────────────────────────────────────────────────────────
function HelpButton({ onClick }) {
  return (
    <button onClick={onClick} style={{ display:"flex", alignItems:"center", gap:6, background:"transparent", border:"1px solid #d8dce8", color:"#7a8099", padding:"6px 14px", borderRadius:4, cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, letterSpacing:1, textTransform:"uppercase", transition:"all .2s" }}>
      ? Help
    </button>
  );
}

// ─── Brand Header ─────────────────────────────────────────────────────────────
function BrandLogo({ size = "normal" }) {
  const big = size === "big";
  return (
    <div style={{ display:"flex", alignItems:"center", gap: big ? 14 : 10 }}>
      {LOGO_URL && <img src={LOGO_URL} alt="Logo" style={{ height: big ? 52 : 36, objectFit:"contain" }} />}
      <div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize: big ? 28 : 20, fontWeight:800, letterSpacing:3, textTransform:"uppercase", color:"#1a1f2e", lineHeight:1 }}>
          Euro<span style={{ color:"#c8a84b" }}>Clock</span>
        </div>
        {big && <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, letterSpacing:2, color:"#9aa0b4", textTransform:"uppercase", marginTop:2 }}>by Eurospec Tooling & Manufacturing</div>}
      </div>
    </div>
  );
}

// ─── Project Code Input ───────────────────────────────────────────────────────
function ProjectInput({ value, onChange, projectCodes }) {
  const [open, setOpen]   = useState(false);
  const [query, setQuery] = useState(value);
  const ref               = useRef(null);

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
    <div ref={ref} style={{ position:"relative" }}>
      <input className="form-input" placeholder="Type or search project code..."
        value={query}
        onChange={e => { setQuery(e.target.value); onChange(e.target.value); setOpen(true); }}
        onFocus={() => setOpen(true)}
        autoComplete="off"
      />
      {open && matches.length > 0 && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:200, background:"#fff", border:"1px solid #d8dce8", borderRadius:4, boxShadow:"0 4px 12px rgba(0,0,0,0.08)", maxHeight:220, overflowY:"auto" }}>
          {matches.slice(0, 50).map(p => (
            <div key={p.code} onMouseDown={() => select(p.code)}
              style={{ padding:"9px 12px", cursor:"pointer", borderBottom:"1px solid #f0f2f5", display:"flex", gap:10, alignItems:"center" }}
              onMouseEnter={e => e.currentTarget.style.background="#f8f9fc"}
              onMouseLeave={e => e.currentTarget.style.background="#fff"}>
              <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, color:"#1a1f2e", letterSpacing:1 }}>{p.code}</span>
              {p.description && <span style={{ color:"#9aa0b4", fontSize:12 }}>— {p.description}</span>}
            </div>
          ))}
        </div>
      )}
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
  const [showHelp, setShowHelp] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      const query = empId.trim()
        ? `id=ilike.${encodeURIComponent(empId.trim())}`
        : `name=ilike.${encodeURIComponent(empName.trim())}`;
      const rows = await db.get("employees", query);
      if (!rows || rows.length === 0) { setError("Employee not found."); return; }
      const emp = rows[0];
      if (emp.password !== password) { setError("Incorrect password."); return; }
      const user = { id: emp.id, name: emp.name, role: emp.role, supervisor: emp.supervisor, category: emp.category || emp.role };
      saveSession(user);
      onLogin(user);
    } catch { setError("Connection error. Please try again."); }
    finally { setLoading(false); }
  };

  const handleIdBlur = async () => {
    if (!empId.trim()) return;
    const rows = await db.get("employees", `id=ilike.${encodeURIComponent(empId.trim())}`);
    if (rows?.[0]) setEmpName(rows[0].name);
  };
  const handleNameBlur = async () => {
    if (!empName.trim()) return;
    const rows = await db.get("employees", `name=ilike.${encodeURIComponent(empName.trim())}`);
    if (rows?.[0]) setEmpId(rows[0].id);
  };

  return (
    <div className="login-wrap">
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <div className="login-box">
        <div style={{ marginBottom:6 }}><BrandLogo size="big" /></div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, letterSpacing:2, color:"#9aa0b4", textTransform:"uppercase", marginBottom:28, marginTop:4 }}>{APP_SLOGAN}</div>

        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:15, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#1a1f2e", marginBottom:20 }}>Sign In</div>
        {error && <div className="login-error">{error}</div>}

        <div className="form-group" style={{ marginBottom:14 }}>
          <label className="form-label">Employee ID</label>
          <input className="form-input" placeholder="e.g. E001" value={empId}
            onChange={e => setEmpId(e.target.value)} onBlur={handleIdBlur} />
        </div>
        <div className="form-group" style={{ marginBottom:14 }}>
          <label className="form-label">— or — Employee Name</label>
          <input className="form-input" placeholder="e.g. Marcus Webb" value={empName}
            onChange={e => setEmpName(e.target.value)} onBlur={handleNameBlur} />
        </div>
        <div className="form-group" style={{ marginBottom:24 }}>
          <label className="form-label">Password</label>
          <input className="form-input" type="password" placeholder="••••••••" value={password}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()} />
        </div>
        <button className="btn btn-primary" style={{ width:"100%" }} onClick={submit} disabled={loading}>
          {loading ? "Signing in..." : "Sign In →"}
        </button>

        <div style={{ marginTop:20, textAlign:"center" }}>
          <button onClick={() => setShowHelp(true)} style={{ background:"transparent", border:"none", color:"#9aa0b4", fontSize:12, cursor:"pointer", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1 }}>
            ? Need help signing in?
          </button>
        </div>

        <div style={{ marginTop:24, textAlign:"center", fontSize:11, color:"#c4c8d4", fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1 }}>
          Developed by: Eurospec
        </div>
      </div>
    </div>
  );
}

// ─── TOOLMAKER / CNC FORM ─────────────────────────────────────────────────────
function ToolmakerForm({ user, showToast, onHelp }) {
  const [date, setDate]        = useState(today());
  const [jobs, setJobs]        = useState([{ id: uid(), job: "", hours: "", rnd: false, comment: "" }]);
  const [projectCodes, setPCs] = useState([]);
  const [myEntries, setMine]   = useState([]);
  const [saving, setSaving]    = useState(false);
  const isCNC = (user.category || user.role) === "cnc";

  useEffect(() => {
    db.get("project_codes", "order=code.asc").then(setPCs);
    db.get("entries", `employee_id=eq.${user.id}&order=created_at.desc&limit=20`).then(setMine);
  }, [user.id]);

  const addRow    = () => setJobs(j => [...j, { id: uid(), job: "", hours: "", rnd: false, comment: "" }]);
  const removeRow = (id) => setJobs(j => j.filter(r => r.id !== id));
  const updateRow = (id, field, val) => setJobs(j => j.map(r => r.id === id ? { ...r, [field]: val } : r));
  const totalHrs  = jobs.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const rndHrs    = jobs.filter(r => r.rnd).reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const regHrs    = totalHrs - rndHrs;

  const submit = async () => {
    if (!date) return;
    const valid = jobs.filter(r => r.job.trim() && r.hours);
    if (!valid.length) return;
    setSaving(true);
    try {
      const status = isCNC ? "approved" : "pending";
      for (const r of valid) {
        await db.post("entries", { id: uid(), employee_id: user.id, employee_name: user.name, date, day: dayOfDate(date), job: r.job.trim(), hours: parseFloat(r.hours), rnd: r.rnd, status, supervisor_id: user.supervisor, notes: r.comment || "" });
      }
      showToast(isCNC ? "Entry submitted and auto-approved." : "Entry submitted — awaiting supervisor approval.");
      setJobs([{ id: uid(), job: "", hours: "", rnd: false, comment: "" }]);
      const updated = await db.get("entries", `employee_id=eq.${user.id}&order=created_at.desc&limit=20`);
      setMine(updated);
    } catch { showToast("Failed to submit. Please try again.", "error"); }
    finally { setSaving(false); }
  };

  return (
    <div className="page">
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:4 }}>
        <div>
          <div className="page-title">Log Time</div>
          <div className="page-sub">{isCNC ? "CNC — entries are auto-approved." : "Toolmaker — entries go to supervisor for approval."}</div>
        </div>
        <HelpButton onClick={onHelp} />
      </div>

      <div className="card">
        <div className="card-title">New Entry</div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Date</label>
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Day</label>
            <div style={{ padding:"10px 12px", background:"#f8f9fc", border:"1px solid #e4e7f0", borderRadius:4, color:"#c8a84b", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:1 }}>
              {date ? dayOfDate(date) : "—"}
            </div>
          </div>
        </div>

        <div className="card-title" style={{ marginTop:8 }}>Jobs & Hours</div>
        <div className="job-rows">
          {jobs.map(row => (
            <div key={row.id} style={{ background: row.rnd ? "#f0faf0" : "#f8f9fc", border:`1px solid ${row.rnd ? "#c0e0c0" : "#e4e7f0"}`, borderRadius:6, padding:"12px 14px", transition:"background .2s, border-color .2s" }}>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 100px auto 28px", gap:10, alignItems:"center" }}>
                <ProjectInput value={row.job} onChange={val => updateRow(row.id, "job", val)} projectCodes={projectCodes} />
                <input className="form-input" type="number" min="0.25" max="24" step="0.25" placeholder="Hrs" value={row.hours} onChange={e => updateRow(row.id, "hours", e.target.value)} />
                <label style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer", userSelect:"none" }}>
                  <input type="checkbox" checked={row.rnd} onChange={e => updateRow(row.id, "rnd", e.target.checked)} style={{ accentColor:"#2a8a2a", width:15, height:15 }} />
                  <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:700, letterSpacing:1.5, padding:"2px 8px", borderRadius:3, transition:"all .2s", whiteSpace:"nowrap", background: row.rnd ? "#eaf5ea" : "#f0f2f5", color: row.rnd ? "#2a8a2a" : "#c4c8d4", border:`1px solid ${row.rnd ? "#c0e0c0" : "#e4e7f0"}` }}>R&D</span>
                </label>
                {jobs.length > 1 ? <button className="btn-icon" onClick={() => removeRow(row.id)}>✕</button> : <span />}
              </div>
              <input className="form-input" placeholder="Comment (optional)..." value={row.comment} onChange={e => updateRow(row.id, "comment", e.target.value)} style={{ marginTop:8, fontSize:13, color:"#9aa0b4", background:"transparent", borderColor:"#e4e7f0" }} />
            </div>
          ))}
        </div>
        <button className="btn-add" onClick={addRow}>+ Add Another Job</button>

        <div style={{ marginTop:16, background:"#f8f9fc", border:"1px solid #e4e7f0", borderRadius:6, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr" }}>
            {[["Regular Hrs", regHrs, "#c8a84b"], ["R&D Hrs", rndHrs, "#2a8a2a"], ["Total Hrs", totalHrs, "#1a1f2e"]].map(([label, val, color]) => (
              <div key={label} style={{ padding:"10px 14px", borderRight: label !== "Total Hrs" ? "1px solid #e4e7f0" : "none" }}>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:10, letterSpacing:2, textTransform:"uppercase", color:"#9aa0b4", marginBottom:4 }}>{label}</div>
                <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:800, color }}>{val.toFixed(2)}</div>
              </div>
            ))}
          </div>
          {totalHrs > 0 && (
            <div style={{ height:4, background:"#e4e7f0", display:"flex" }}>
              <div style={{ width:`${(regHrs/totalHrs*100).toFixed(0)}%`, background:"#c8a84b", transition:"width .3s" }} />
              <div style={{ width:`${(rndHrs/totalHrs*100).toFixed(0)}%`, background:"#2a8a2a", transition:"width .3s" }} />
            </div>
          )}
        </div>

        <div style={{ display:"flex", justifyContent:"flex-end", marginTop:16 }}>
          <button className="btn btn-primary" onClick={submit} disabled={saving}>{saving ? "Submitting..." : "Submit Entry →"}</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">My Recent Entries</div>
        {myEntries.length === 0
          ? <div style={{ color:"#c4c8d4", fontStyle:"italic", fontSize:13 }}>No entries yet.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Day</th><th>Project</th><th>Hrs</th><th>Type</th><th>Comment</th><th>Status</th></tr></thead>
                <tbody>
                  {myEntries.map(e => (
                    <tr key={e.id}>
                      <td>{e.date}</td><td>{e.day}</td>
                      <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:1, color:"#1a1f2e" }}>{e.job}</td>
                      <td>{e.hours}</td>
                      <td>{e.rnd ? <span className="rnd-badge">R&D</span> : <span style={{ color:"#9aa0b4", fontSize:11 }}>Regular</span>}</td>
                      <td style={{ color:"#9aa0b4", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.notes || "—"}</td>
                      <td><span className={`pill pill-${e.status}`}>{e.status}</span></td>
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

// ─── SUPERVISOR VIEW ──────────────────────────────────────────────────────────
function SupervisorView({ user, showToast, onHelp }) {
  const [entries, setEntries]       = useState([]);
  const [filter, setFilter]         = useState("pending");
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [teamIds, setTeamIds]       = useState([]);
  const [editEntry, setEditEntry]   = useState(null); // entry being edited

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
    await db.patch("entries", `id=eq.${editEntry.id}`, {
      hours: parseFloat(editEntry.hours),
      job: editEntry.job,
      notes: editEntry.notes,
      status: "approved"
    });
    setEntries(prev => prev.map(e => e.id === editEntry.id ? { ...e, hours: parseFloat(editEntry.hours), job: editEntry.job, notes: editEntry.notes, status: "approved" } : e));
    showToast("Entry edited and approved.");
    setEditEntry(null);
  };

  const visible = entries.filter(e => filter === "all" || e.status === filter);
  const pending = entries.filter(e => e.status === "pending").length;

  return (
    <div className="page">
      {/* Edit Modal */}
      {editEntry && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:8, width:"100%", maxWidth:480, padding:28, boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:16, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#1a1f2e", marginBottom:4 }}>Edit & Approve Entry</div>
            <div style={{ fontSize:12, color:"#9aa0b4", marginBottom:20 }}>Make corrections then approve. Entry will go directly to Finance.</div>
            <div className="form-group" style={{ marginBottom:14 }}>
              <label className="form-label">Employee</label>
              <input className="form-input" value={editEntry.employee_name} disabled style={{ background:"#f8f9fc", color:"#9aa0b4" }} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Project Code</label>
                <input className="form-input" value={editEntry.job} onChange={e => setEditEntry(p => ({ ...p, job: e.target.value }))} />
              </div>
              <div className="form-group">
                <label className="form-label">Hours</label>
                <input className="form-input" type="number" min="0.25" max="24" step="0.25" value={editEntry.hours} onChange={e => setEditEntry(p => ({ ...p, hours: e.target.value }))} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom:20 }}>
              <label className="form-label">Comment</label>
              <input className="form-input" value={editEntry.notes || ""} onChange={e => setEditEntry(p => ({ ...p, notes: e.target.value }))} />
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setEditEntry(null)}>Cancel</button>
              <button className="btn btn-success" onClick={saveEdit}>✓ Save & Approve</button>
            </div>
          </div>
        </div>
      )}

      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:4 }}>
        <div>
          <div className="page-title">Supervisor Review</div>
          <div className="page-sub">Review and approve timesheet entries from your team</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <HelpButton onClick={onHelp} />
          <RefreshBtn onClick={() => load(true)} loading={refreshing} />
        </div>
      </div>

      <div className="stats-row" style={{ gridTemplateColumns:"repeat(3,1fr)" }}>
        {[["Pending", pending, "#c8a84b", "awaiting review"], ["Team Size", teamIds.length, "#1a1f2e", "members"], ["Total Entries", entries.length, "#1a1f2e", "all time"]].map(([label, val, color, sub]) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-val" style={{ color }}>{val}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      <div className="filters">
        {["pending","approved","rejected","all"].map(f => (
          <button key={f} className={`btn btn-sm ${filter === f ? "btn-primary" : "btn-secondary"}`} onClick={() => setFilter(f)}>{f.charAt(0).toUpperCase() + f.slice(1)}</button>
        ))}
      </div>

      <div className="card">
        {loading ? <Spinner /> : visible.length === 0
          ? <div style={{ color:"#c4c8d4", fontStyle:"italic", fontSize:13 }}>No entries.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Employee</th><th>Date</th><th>Day</th><th>Project</th><th>Hrs</th><th>Type</th><th>Comment</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {visible.map(e => (
                    <tr key={e.id}>
                      <td style={{ color:"#1a1f2e" }}>{e.employee_name}</td>
                      <td>{e.date}</td><td>{e.day}</td>
                      <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:1, color:"#1a1f2e" }}>{e.job}</td>
                      <td>{e.hours}</td>
                      <td>{e.rnd ? <span className="rnd-badge">R&D</span> : <span style={{ color:"#9aa0b4", fontSize:11 }}>Regular</span>}</td>
                      <td style={{ color:"#9aa0b4", maxWidth:160, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.notes || "—"}</td>
                      <td><span className={`pill pill-${e.status}`}>{e.status}</span></td>
                      <td>
                        <div style={{ display:"flex", gap:6 }}>
                          {e.status === "pending" && <>
                            <button className="btn btn-sm btn-success" onClick={() => update(e.id, "approved")}>✓</button>
                            <button className="btn btn-sm btn-danger" onClick={() => update(e.id, "rejected")}>✕</button>
                          </>}
                          {(e.status === "pending" || e.status === "rejected") &&
                            <button className="btn btn-sm btn-secondary" onClick={() => setEditEntry({ ...e })}>Edit</button>}
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

// ─── FINANCE DASHBOARD ────────────────────────────────────────────────────────
function FinanceDashboard({ onHelp }) {
  const [entries, setEntries]       = useState([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [fromDate, setFromDate]     = useState("");
  const [toDate, setToDate]         = useState("");
  const [empFilter, setEmpFilter]   = useState("");
  const [jobFilter, setJobFilter]   = useState("");

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true); else setLoading(true);
    const data = await db.get("entries", "status=eq.approved&order=date.asc,created_at.asc");
    setEntries(data);
    if (isRefresh) setRefreshing(false); else setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const filtered = entries.filter(e => {
    if (fromDate && e.date < fromDate) return false;
    if (toDate   && e.date > toDate)   return false;
    if (empFilter && !e.employee_name.toLowerCase().includes(empFilter.toLowerCase())) return false;
    if (jobFilter && !e.job.toLowerCase().includes(jobFilter.toLowerCase())) return false;
    return true;
  });

  const withSeq  = computeSeq(filtered);
  const totalHrs = filtered.reduce((s, e) => s + Number(e.hours), 0);
  const rndHrs   = filtered.filter(e => e.rnd).reduce((s, e) => s + Number(e.hours), 0);
  const regHrs   = totalHrs - rndHrs;

  const exportCSV = () => {
    const rows = [["Project Code","Date of Work","Employee Code","Date Seq","Hours Work","Project Part","Project Cost","Comment","Plant"]];
    withSeq.forEach(e => rows.push([e.job, e.date, e.employee_id, e.dateSeq, e.hours, "", e.rnd ? "RD" : "LB", e.notes || "", "PET"]));
    const csv = rows.map(r => r.map(c => `"${c}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type:"text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `euroclock-epicor-${fromDate || today()}-to-${toDate || today()}.csv`;
    a.click();
  };

  return (
    <div className="page">
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:4 }}>
        <div>
          <div className="page-title">Finance Dashboard</div>
          <div className="page-sub">Approved entries — filter and export in Epicor format</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
          <HelpButton onClick={onHelp} />
          <RefreshBtn onClick={() => load(true)} loading={refreshing} />
        </div>
      </div>

      <div className="stats-row">
        {[["Total Hours", totalHrs.toFixed(1), "#1a1f2e", "approved + filtered"], ["LB Hours", regHrs.toFixed(1), "#c8a84b", "regular labour"], ["RD Hours", rndHrs.toFixed(1), "#2a8a2a", "research & dev"], ["Line Items", filtered.length, "#1a1f2e", "export rows"]].map(([label, val, color, sub]) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-val" style={{ color }}>{val}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div className="card-title">Filter & Export</div>
        <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
          <button className="btn btn-sm btn-secondary" onClick={() => { const r = getWeekRange(0);  setFromDate(r.from); setToDate(r.to); }}>This Week</button>
          <button className="btn btn-sm btn-secondary" onClick={() => { const r = getWeekRange(-1); setFromDate(r.from); setToDate(r.to); }}>Last Week</button>
          <button className="btn btn-sm btn-secondary" onClick={() => { const r = getMonthRange(0);  setFromDate(r.from); setToDate(r.to); }}>This Month</button>
          <button className="btn btn-sm btn-secondary" onClick={() => { const r = getMonthRange(-1); setFromDate(r.from); setToDate(r.to); }}>Last Month</button>
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
        <div style={{ display:"flex", gap:12, alignItems:"flex-end" }}>
          <div className="form-group" style={{ flex:1 }}>
            <label className="form-label">Project Code</label>
            <input className="form-input" placeholder="e.g. 2161" value={jobFilter} onChange={e => setJobFilter(e.target.value)} />
          </div>
          <button className="btn btn-primary" onClick={exportCSV}>↓ Export Epicor CSV ({filtered.length} rows)</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">Epicor Export Preview</div>
        <div style={{ marginBottom:12, padding:"8px 12px", background:"#fffdf5", border:"1px solid #f0dfa0", borderRadius:4, fontSize:12, color:"#b8860b", fontFamily:"'Barlow Condensed',sans-serif" }}>
          Project Code · Date of Work · Employee Code · Date Seq · Hours Work · Project Part · Project Cost (LB/RD) · Comment · Plant
        </div>
        {loading ? <Spinner /> : withSeq.length === 0
          ? <div style={{ color:"#c4c8d4", fontStyle:"italic", fontSize:13 }}>No approved entries match your filters.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Project Code</th><th>Date of Work</th><th>Emp Code</th><th>Date Seq</th><th>Hrs Work</th><th>Proj Part</th><th>Proj Cost</th><th>Comment</th><th>Plant</th></tr></thead>
                <tbody>
                  {withSeq.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, color:"#1a1f2e" }}>{e.job}</td>
                      <td>{e.date}</td>
                      <td style={{ fontFamily:"'Barlow Condensed',sans-serif", color:"#9aa0b4" }}>{e.employee_id}</td>
                      <td style={{ textAlign:"center", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, color:"#c8a84b" }}>{e.dateSeq}</td>
                      <td>{e.hours}</td>
                      <td style={{ color:"#c4c8d4" }}>—</td>
                      <td><span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:700, letterSpacing:1, padding:"2px 8px", borderRadius:3, background: e.rnd ? "#eaf5ea" : "#fff8e6", color: e.rnd ? "#2a8a2a" : "#b8860b", border:`1px solid ${e.rnd ? "#c0e0c0" : "#f0dfa0"}` }}>{e.rnd ? "RD" : "LB"}</span></td>
                      <td style={{ color:"#9aa0b4", maxWidth:180, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.notes || "—"}</td>
                      <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, color:"#9aa0b4" }}>PET</td>
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

// ─── PROJECT CODES ────────────────────────────────────────────────────────────
function ProjectCodesManager({ showToast, onHelp }) {
  const [codes, setCodes]     = useState([]);
  const [code, setCode]       = useState("");
  const [desc, setDesc]       = useState("");
  const [error, setError]     = useState("");
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
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:4 }}>
        <div>
          <div className="page-title">Project Codes</div>
          <div className="page-sub">Manage project codes — employees type and select from this list</div>
        </div>
        <HelpButton onClick={onHelp} />
      </div>
      <div className="card">
        <div className="card-title">Add Project Code</div>
        {error && <div className="login-error" style={{ marginBottom:16 }}>{error}</div>}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Project Code</label>
            <input className="form-input" placeholder="e.g. 2267" value={code} onChange={e => setCode(e.target.value)} />
          </div>
          <div className="form-group">
            <label className="form-label">Description (optional)</label>
            <input className="form-input" placeholder="e.g. New Mould Assembly" value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
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
                    <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, fontSize:15, color:"#1a1f2e", letterSpacing:1 }}>{p.code}</td>
                    <td style={{ color:"#4a5068" }}>{p.description || "—"}</td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => remove(p.code)}>Remove</button></td>
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

// ─── ADMIN ────────────────────────────────────────────────────────────────────
function AdminView({ showToast, onHelp }) {
  const [employees, setEmployees] = useState([]);
  const [entries, setEntries]     = useState([]);
  const [form, setForm]           = useState({ id:"", name:"", role:"toolmaker", category:"toolmaker", password:"", supervisor:"" });
  const [editing, setEditing]     = useState(null);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(true);

  useEffect(() => {
    Promise.all([db.get("employees", "order=id.asc"), db.get("entries", "select=employee_id")])
      .then(([emps, ents]) => { setEmployees(emps); setEntries(ents); setLoading(false); });
  }, []);

  const supervisors = employees.filter(e => e.role === "supervisor");

  const save = async () => {
    setError("");
    if (!form.id || !form.name || !form.password) { setError("ID, Name, and Password are required."); return; }
    if (!editing && employees.find(e => e.id === form.id)) { setError("Employee ID already exists."); return; }
    const payload = { name: form.name, role: form.role, category: form.category || form.role, password: form.password, supervisor: form.supervisor || null };
    if (editing) {
      await db.patch("employees", `id=eq.${editing}`, payload);
      setEmployees(prev => prev.map(e => e.id === editing ? { ...e, ...payload } : e));
    } else {
      await db.post("employees", { id: form.id, ...payload });
      setEmployees(prev => [...prev, { id: form.id, ...payload }]);
    }
    showToast(editing ? "Employee updated." : "Employee added.");
    setForm({ id:"", name:"", role:"toolmaker", category:"toolmaker", password:"", supervisor:"" });
    setEditing(null);
  };

  const remove = async (id) => {
    await db.delete("employees", `id=eq.${id}`);
    setEmployees(prev => prev.filter(e => e.id !== id));
    showToast("Employee removed.");
  };

  const roleColor = { toolmaker:"#c8a84b", cnc:"#2a7a9a", supervisor:"#2a8a2a", finance:"#7a2a9a", admin:"#cc4444" };

  return (
    <div className="page">
      <div style={{ display:"flex", alignItems:"flex-start", justifyContent:"space-between", marginBottom:4 }}>
        <div>
          <div className="page-title">Admin Panel</div>
          <div className="page-sub">Manage employees, roles, and access</div>
        </div>
        <HelpButton onClick={onHelp} />
      </div>

      <div className="card">
        <div className="card-title">{editing ? "Edit Employee" : "Add Employee"}</div>
        {error && <div className="login-error" style={{ marginBottom:16 }}>{error}</div>}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Employee ID</label>
            <input className="form-input" placeholder="e.g. E004" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} disabled={!!editing} />
          </div>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" placeholder="First Last" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
        </div>
        <div className="form-row-3">
          <div className="form-group">
            <label className="form-label">Role / Category</label>
            <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, category: e.target.value }))}>
              <option value="toolmaker">Toolmaker — needs approval</option>
              <option value="cnc">CNC — auto-approved</option>
              <option value="supervisor">Supervisor</option>
              <option value="finance">Finance</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Password</label>
            <input className="form-input" type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} />
          </div>
          {(form.role === "toolmaker" || form.role === "cnc") && (
            <div className="form-group">
              <label className="form-label">Supervisor</label>
              <select className="form-select" value={form.supervisor} onChange={e => setForm(f => ({ ...f, supervisor: e.target.value }))}>
                <option value="">— Assign Supervisor —</option>
                {supervisors.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
              </select>
            </div>
          )}
        </div>
        {form.role === "toolmaker" && <div style={{ marginTop:8, padding:"8px 12px", background:"#fff8e6", border:"1px solid #f0dfa0", borderRadius:4, fontSize:12, color:"#b8860b" }}>Toolmaker entries require supervisor approval before going to Finance.</div>}
        {form.role === "cnc" && <div style={{ marginTop:8, padding:"8px 12px", background:"#e8f4ff", border:"1px solid #b0d4f0", borderRadius:4, fontSize:12, color:"#2a6a9a" }}>CNC entries are auto-approved and go directly to Finance.</div>}
        <div style={{ display:"flex", gap:10, marginTop:12 }}>
          <button className="btn btn-primary" onClick={save}>{editing ? "Save Changes" : "Add Employee"}</button>
          {editing && <button className="btn btn-secondary" onClick={() => { setEditing(null); setForm({ id:"",name:"",role:"toolmaker",category:"toolmaker",password:"",supervisor:"" }); }}>Cancel</button>}
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
                  const sup  = employees.find(e => e.id === emp.supervisor);
                  const role = emp.category || emp.role;
                  return (
                    <tr key={emp.id}>
                      <td style={{ fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, color:"#9aa0b4" }}>{emp.id}</td>
                      <td style={{ color:"#1a1f2e" }}>{emp.name}</td>
                      <td>
                        <span style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, fontWeight:700, letterSpacing:1, textTransform:"uppercase", color: roleColor[role] || "#1a1f2e" }}>{role}</span>
                        {role === "cnc" && <span style={{ marginLeft:6, fontSize:10, color:"#9aa0b4" }}>auto</span>}
                      </td>
                      <td style={{ color:"#9aa0b4" }}>{sup ? sup.name : "—"}</td>
                      <td>{entries.filter(e => e.employee_id === emp.id).length}</td>
                      <td>
                        <div style={{ display:"flex", gap:8 }}>
                          <button className="btn btn-sm btn-secondary" onClick={() => { setForm({ ...emp, category: emp.category || emp.role, supervisor: emp.supervisor || "" }); setEditing(emp.id); }}>Edit</button>
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
      <Footer />
    </div>
  );
}

// ─── APP ROOT ─────────────────────────────────────────────────────────────────
export default function App() {
  const [user,     setUser]     = useState(() => loadSession());
  const [tab,      setTab]      = useState(null);
  const [toast,    setToast]    = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const inactivityTimer         = useRef(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const tabMap = {
    toolmaker:  [{ id:"log",      label:"Log Time"      }],
    cnc:        [{ id:"log",      label:"Log Time"      }],
    supervisor: [{ id:"review",   label:"Review"        }],
    finance:    [{ id:"finance",  label:"Dashboard"     }, { id:"projects", label:"Project Codes" }],
    admin:      [{ id:"admin",    label:"Admin"         }, { id:"finance",  label:"Finance View"  }, { id:"projects", label:"Project Codes" }],
  };

  useEffect(() => { if (user && !tab) setTab(tabMap[user.role]?.[0]?.id || "log"); }, [user]);

  const resetTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(() => { clearSession(); setUser(null); setTab(null); }, INACTIVITY_MS);
  }, []);

  useEffect(() => {
    if (!user) return;
    const events = ["mousemove","keydown","click","scroll","touchstart"];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => { events.forEach(e => window.removeEventListener(e, resetTimer)); if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };
  }, [user, resetTimer]);

  const handleLogin  = emp => { setUser(emp); saveSession(emp); setTab(tabMap[emp.role]?.[0]?.id || "log"); };
  const handleLogout = () => { clearSession(); setUser(null); setTab(null); if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };

  if (!user) return <div className="app"><Login onLogin={handleLogin} /></div>;

  const roleTabs = tabMap[user.role] || [];

  return (
    <div className="app">
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <header className="header">
        <BrandLogo />
        <div className="header-right">
          <div className="header-user">
            <strong>{user.name}</strong> · {user.id}
            {(user.category === "cnc" || user.role === "cnc") && <span style={{ marginLeft:8, fontSize:10, background:"#e8f4ff", color:"#2a6a9a", padding:"1px 6px", borderRadius:3, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1 }}>CNC</span>}
          </div>
          <button className="btn-logout" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>

      {roleTabs.length > 1 && (
        <nav className="nav-tabs">
          {roleTabs.map(t => (
            <button key={t.id} className={`nav-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
      )}

      {tab === "log"      && <ToolmakerForm      user={user} showToast={showToast} onHelp={() => setShowHelp(true)} />}
      {tab === "review"   && <SupervisorView     user={user} showToast={showToast} onHelp={() => setShowHelp(true)} />}
      {tab === "finance"  && <FinanceDashboard   showToast={showToast}             onHelp={() => setShowHelp(true)} />}
      {tab === "projects" && <ProjectCodesManager showToast={showToast}            onHelp={() => setShowHelp(true)} />}
      {tab === "admin"    && <AdminView          showToast={showToast}             onHelp={() => setShowHelp(true)} />}

      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
    </div>
  );
}
