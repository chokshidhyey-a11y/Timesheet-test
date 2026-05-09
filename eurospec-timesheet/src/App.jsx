import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://dtnrkerxtjpjfomtotcs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bnJrZXJ4dGpwamZvbXRvdGNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzUzNDIsImV4cCI6MjA5MzgxMTM0Mn0.0bfZaNIOTUcM8EfTwUR-gbESwYkMFBnFj0Kc1NHOUEo";
const LOGO_URL     = "https://eurospectooling.com/wp-content/uploads/2024/03/logo-e1711467462820.png";
const INACTIVITY_MS = 10 * 60 * 1000;
const APP_SLOGAN   = "Log it. Approve it. Export it.";
const DEV_NAME     = "Dhyey Chokshi (Software Developer)";
const DEV_EMAIL    = "dchokshi@eurospectooling.com";
const HIGHER_ROLES = ["supervisor", "finance", "admin"];

// ─── Supabase Auth ────────────────────────────────────────────────────────────
const auth = {
  signIn: async (empId, password) => {
    const email = empId.toLowerCase() + "@euroclock.eurospec.internal";
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.error);
    return data;
  },
  signOut: async (token) => {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
    });
  },
  // Send reset email to work email via Supabase
  resetPassword: async (workEmail) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: workEmail })
    });
    return res.ok;
  },
  // Update password using access token
  updatePassword: async (token, newPassword) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword })
    });
    return res.ok;
  }
};

const rpc = async (fn, params) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  return res.ok;
};

// ─── Supabase DB ──────────────────────────────────────────────────────────────
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
    <button onClick={onClick} disabled={loading} className="refresh-btn">
      <span style={{ display:"inline-block", animation: loading ? "spin 0.8s linear infinite" : "none" }}>↻</span>
      <span className="refresh-label">{loading ? "Refreshing..." : "Refresh"}</span>
    </button>
  );
}
function Footer() {
  return (
    <div style={{ textAlign:"right", padding:"12px 16px", fontSize:11, color:"#c4c8d4", letterSpacing:1, borderTop:"1px solid #f0f2f5", marginTop:16 }}>
      Developed by: Eurospec
    </div>
  );
}
function HelpButton({ onClick }) {
  return <button onClick={onClick} className="help-btn">? Help</button>;
}

// ─── Help Modal ───────────────────────────────────────────────────────────────
function HelpModal({ onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:10, width:"100%", maxWidth:680, maxHeight:"90vh", overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ background:"#1a1f2e", borderRadius:"10px 10px 0 0", padding:"20px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:800, color:"#c8a84b" }}>EuroClock <span style={{ color:"#fff" }}>Help Center</span></div>
            <div style={{ fontSize:12, color:"#9aa0b4", marginTop:2 }}>Everything you need to know</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#9aa0b4", fontSize:22, cursor:"pointer", padding:"4px 8px" }}>✕</button>
        </div>
        <div style={{ padding:"20px" }}>
          {[
            { role:"👷 Toolmaker / CNC", color:"#fff8e6", border:"#f0dfa0", steps:["Sign in with your Employee ID and password.","On first login you'll be asked to set a new password.","Select the date and search for your Project Code.","Enter hours. Check R&D if applicable. Add a comment if needed.","Tap Submit. Toolmaker entries go to your supervisor; CNC entries auto-approve."] },
            { role:"👔 Supervisor", color:"#f0faf0", border:"#c0e0c0", steps:["Sign in — you'll set a new password on first login.","Go to Review tab to see pending entries from your team.","Tap ✓ to approve, ✕ to reject, or Edit to fix and approve.","Use Refresh to load new entries without reloading the page.","Forgot your password? Use the Forgot Password link on the login screen."] },
            { role:"💼 Finance", color:"#f0f4ff", border:"#b0c4f0", steps:["Sign in — set a new password on first login.","Use quick filters or custom date range.","Export Epicor CSV downloads in the exact format needed.","Go to Project Codes tab to manage codes for the team.","Forgot password? Use the reset link — it goes to your work email."] },
            { role:"🔧 Admin", color:"#fdf0f0", border:"#f0c0c0", steps:["Add employees with their ID, name, role, and a temporary password.","All employees must change their password on first login.","For supervisors/finance/admin, add their work email for password resets.","Edit passwords anytime — changes sync immediately."] },
          ].map(s => (
            <div key={s.role} style={{ marginBottom:12, background:s.color, border:`1px solid ${s.border}`, borderRadius:8, padding:"12px 16px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#1a1f2e", marginBottom:8 }}>{s.role}</div>
              <ol style={{ paddingLeft:18, margin:0 }}>
                {s.steps.map((step, i) => <li key={i} style={{ fontSize:13, color:"#4a5068", marginBottom:4, lineHeight:1.5 }}>{step}</li>)}
              </ol>
            </div>
          ))}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#c8a84b", marginBottom:10, paddingBottom:6, borderBottom:"2px solid #f0f2f5" }}>FAQ</div>
            {[
              ["Will I be logged out if I refresh?","No — your session persists. You'll only be logged out after 10 minutes of inactivity."],
              ["What is LB vs RD?","LB = regular labour hours. RD = Research & Development. Check the R&D box when logging."],
              ["I forgot my password — what do I do?","On the login screen click Forgot Password. Supervisors/Finance/Admin get a reset email. Toolmakers/CNC ask their admin to reset it."],
              ["What is Date Seq in the export?","Only filled when you log multiple entries for the same project on the same day."],
            ].map(([q, a]) => (
              <div key={q} style={{ marginBottom:10, padding:"10px 14px", background:"#f8f9fc", borderRadius:6, border:"1px solid #e4e7f0" }}>
                <div style={{ fontWeight:600, fontSize:13, color:"#1a1f2e", marginBottom:4 }}>{q}</div>
                <div style={{ fontSize:13, color:"#7a8099", lineHeight:1.5 }}>{a}</div>
              </div>
            ))}
          </div>
          <div style={{ background:"#1a1f2e", borderRadius:8, padding:"18px 20px" }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#c8a84b", marginBottom:12 }}>Contact Us</div>
            <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"#c8a84b", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16, color:"#1a1f2e", flexShrink:0 }}>DC</div>
              <div>
                <div style={{ color:"#fff", fontWeight:600, fontSize:14 }}>{DEV_NAME}</div>
                <div style={{ color:"#9aa0b4", fontSize:12, marginTop:2 }}>EuroClock · Eurospec Tooling & Manufacturing</div>
                <a href={`mailto:${DEV_EMAIL}`} style={{ color:"#c8a84b", fontSize:13, marginTop:4, display:"block", textDecoration:"none" }}>📧 {DEV_EMAIL}</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CHANGE PASSWORD SCREEN ───────────────────────────────────────────────────
function ChangePasswordScreen({ user, onDone, showToast }) {
  const [newPass, setNewPass]     = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState("");
  const [saving, setSaving]       = useState(false);
  const isHigher = HIGHER_ROLES.includes(user.role);

  const submit = async () => {
    setError("");
    if (newPass.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPass !== confirm) { setError("Passwords don't match."); return; }
    setSaving(true);
    try {
      // Use RPC with admin privileges to update encrypted password
      const ok = await rpc("update_employee_password", { emp_id: user.id, new_password: newPass });
      if (!ok) throw new Error("RPC update failed");
      // Update plain text copy in employees table (for admin visibility)
      await db.patch("employees", `id=eq.${user.id}`, { password: newPass, must_change_password: false });
      showToast("Password updated successfully!");
      onDone();
    } catch { setError("Failed to update password. Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-box" style={{ position:"relative", overflow:"hidden" }}>
        {LOGO_URL && <img src={LOGO_URL} alt="Logo" style={{ position:"absolute", top:0, right:0, height:56, objectFit:"contain", borderRadius:"0 8px 0 0", padding:"6px 8px 4px 4px" }} />}
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, letterSpacing:3, textTransform:"uppercase", color:"#1a1f2e", marginBottom:4 }}>
          Euro<span style={{ color:"#c8a84b" }}>Clock</span>
        </div>
        <div style={{ marginBottom:24 }}>
          <div style={{ background:"#fff8e6", border:"1px solid #f0dfa0", borderRadius:6, padding:"12px 14px" }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#b8860b", marginBottom:4 }}>🔐 Set Your Password</div>
            <div style={{ fontSize:13, color:"#7a8099", lineHeight:1.5 }}>
              Welcome, <strong>{user.name}</strong>! This is your first login.
              Please set a personal password to continue.
              {isHigher && <span> Your admin can also send a reset link to your work email if you ever forget it.</span>}
            </div>
          </div>
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group" style={{ marginBottom:14 }}>
          <label className="form-label">New Password</label>
          <input className="form-input" type="password" placeholder="Min 6 characters" value={newPass}
            onChange={e => setNewPass(e.target.value)} style={{ fontSize:16 }} />
        </div>
        <div className="form-group" style={{ marginBottom:24 }}>
          <label className="form-label">Confirm Password</label>
          <input className="form-input" type="password" placeholder="Re-enter password" value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()} style={{ fontSize:16 }} />
        </div>
        <button className="btn btn-primary" style={{ width:"100%", padding:"14px", fontSize:15 }} onClick={submit} disabled={saving}>
          {saving ? "Saving..." : "Set Password & Continue →"}
        </button>
        <div style={{ marginTop:16, padding:"10px 12px", background:"#f8f9fc", borderRadius:6, fontSize:12, color:"#9aa0b4" }}>
          💡 Choose something you'll remember. You can always contact your admin if you get locked out.
        </div>
      </div>
    </div>
  );
}

// ─── FORGOT PASSWORD SCREEN ───────────────────────────────────────────────────
function ForgotPasswordScreen({ onBack }) {
  const [empId, setEmpId]   = useState("");
  const [email, setEmail]   = useState("");
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [mode, setMode]     = useState(null); // "email" or "admin"

  const checkEmployee = async () => {
    setError("");
    if (!empId.trim()) { setError("Please enter your Employee ID."); return; }
    setLoading(true);
    try {
      const rows = await db.get("employees", `id=ilike.${encodeURIComponent(empId.trim())}`);
      if (!rows || rows.length === 0) { setError("Employee not found."); return; }
      const emp = rows[0];
      if (HIGHER_ROLES.includes(emp.role) && emp.work_email) {
        setMode("email");
        setEmail(emp.work_email);
      } else {
        setMode("admin");
      }
    } catch { setError("Connection error. Try again."); }
    finally { setLoading(false); }
  };

  const sendReset = async () => {
    setLoading(true);
    try {
      await auth.resetPassword(email);
      setSent(true);
    } catch { setError("Failed to send reset email. Contact your admin."); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, letterSpacing:3, textTransform:"uppercase", color:"#1a1f2e", marginBottom:20 }}>
          Euro<span style={{ color:"#c8a84b" }}>Clock</span>
        </div>

        {sent ? (
          <div>
            <div style={{ background:"#eaf5ea", border:"1px solid #c0e0c0", borderRadius:8, padding:"16px", marginBottom:20 }}>
              <div style={{ fontWeight:700, color:"#2a8a2a", marginBottom:6 }}>✓ Reset Email Sent</div>
              <div style={{ fontSize:13, color:"#4a5068", lineHeight:1.5 }}>
                A password reset link has been sent to <strong>{email}</strong>. Check your inbox and follow the link to reset your password.
              </div>
            </div>
            <button className="btn btn-primary" style={{ width:"100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        ) : mode === "admin" ? (
          <div>
            <div style={{ background:"#fff8e6", border:"1px solid #f0dfa0", borderRadius:8, padding:"16px", marginBottom:20 }}>
              <div style={{ fontWeight:700, color:"#b8860b", marginBottom:6 }}>Contact Your Admin</div>
              <div style={{ fontSize:13, color:"#4a5068", lineHeight:1.5 }}>
                Password resets for Toolmakers and CNC operators are handled by your Admin. Please ask them to reset your password in the Admin panel.
              </div>
            </div>
            <button className="btn btn-primary" style={{ width:"100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        ) : mode === "email" ? (
          <div>
            <div style={{ fontSize:13, color:"#7a8099", marginBottom:16 }}>
              We'll send a reset link to your work email:
            </div>
            <div style={{ padding:"12px 14px", background:"#f8f9fc", border:"1px solid #e4e7f0", borderRadius:6, marginBottom:20, fontWeight:600, color:"#1a1f2e" }}>
              📧 {email}
            </div>
            {error && <div className="login-error">{error}</div>}
            <button className="btn btn-primary" style={{ width:"100%", padding:"14px", marginBottom:12 }} onClick={sendReset} disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            <button className="btn btn-secondary" style={{ width:"100%" }} onClick={onBack}>Cancel</button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:14, color:"#1a1f2e", marginBottom:16, fontWeight:600 }}>Forgot Password</div>
            <div style={{ fontSize:13, color:"#7a8099", marginBottom:16 }}>Enter your Employee ID and we'll help you reset your password.</div>
            {error && <div className="login-error">{error}</div>}
            <div className="form-group" style={{ marginBottom:16 }}>
              <label className="form-label">Employee ID</label>
              <input className="form-input" placeholder="e.g. E001" value={empId}
                onChange={e => setEmpId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && checkEmployee()}
                style={{ fontSize:16 }} />
            </div>
            <button className="btn btn-primary" style={{ width:"100%", padding:"14px", marginBottom:12 }} onClick={checkEmployee} disabled={loading}>
              {loading ? "Checking..." : "Continue →"}
            </button>
            <button className="btn btn-secondary" style={{ width:"100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PROJECT CODE INPUT ───────────────────────────────────────────────────────
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
        autoComplete="off" style={{ fontSize:16 }}
      />
      {open && matches.length > 0 && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:200, background:"#fff", border:"1px solid #d8dce8", borderRadius:4, boxShadow:"0 4px 12px rgba(0,0,0,0.12)", maxHeight:240, overflowY:"auto" }}>
          {matches.slice(0, 50).map(p => (
            <div key={p.code} onMouseDown={() => select(p.code)} onTouchEnd={() => select(p.code)}
              style={{ padding:"12px 14px", cursor:"pointer", borderBottom:"1px solid #f0f2f5", display:"flex", gap:10, alignItems:"center", minHeight:44 }}
              onMouseEnter={e => e.currentTarget.style.background="#f8f9fc"}
              onMouseLeave={e => e.currentTarget.style.background="#fff"}>
              <span style={{ fontWeight:700, color:"#1a1f2e", fontSize:15 }}>{p.code}</span>
              {p.description && <span style={{ color:"#9aa0b4", fontSize:13 }}>— {p.description}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin, onForgot }) {
  const [empId, setEmpId]       = useState("");
  const [empName, setEmpName]   = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      let resolvedId = empId.trim();
      if (!resolvedId && empName.trim()) {
        const rows = await db.get("employees", `name=ilike.${encodeURIComponent(empName.trim())}`);
        if (!rows || rows.length === 0) { setError("Employee not found."); return; }
        resolvedId = rows[0].id;
        setEmpId(resolvedId);
      }
      if (!resolvedId) { setError("Please enter your Employee ID or name."); return; }
        // Must have a password entered
      if (!password) { setError("Please enter your password."); return; }

      // Load employee profile
      const rows = await db.get("employees", `id=ilike.${encodeURIComponent(resolvedId)}`);
      if (!rows || rows.length === 0) { setError("Employee not found."); return; }
      const emp = rows[0];

      // Try Supabase Auth (encrypted password), fall back to plain text for employees without auth accounts
      let authToken = null;
      try {
        const authData = await auth.signIn(resolvedId, password);
        authToken = authData.access_token;
      } catch {
        // Auth account doesn't exist — validate plain text password instead
        if (!emp.password || emp.password !== password) {
          setError("Incorrect password."); return;
        }
      }

      const user = { id: emp.id, name: emp.name, role: emp.role, supervisor: emp.supervisor, category: emp.category || emp.role, token: authToken, mustChangePassword: emp.must_change_password };
      saveSession(user); onLogin(user);eRef, useCallback } from "react";
import "./App.css";

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://dtnrkerxtjpjfomtotcs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bnJrZXJ4dGpwamZvbXRvdGNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzUzNDIsImV4cCI6MjA5MzgxMTM0Mn0.0bfZaNIOTUcM8EfTwUR-gbESwYkMFBnFj0Kc1NHOUEo";
const LOGO_URL     = "https://eurospectooling.com/wp-content/uploads/2024/03/logo-e1711467462820.png";
const INACTIVITY_MS = 10 * 60 * 1000;
const APP_SLOGAN   = "Log it. Approve it. Export it.";
const DEV_NAME     = "Dhyey Chokshi (Software Developer)";
const DEV_EMAIL    = "dchokshi@eurospectooling.com";
const HIGHER_ROLES = ["supervisor", "finance", "admin"];

// ─── Supabase Auth ────────────────────────────────────────────────────────────
const auth = {
  signIn: async (empId, password) => {
    const email = empId.toLowerCase() + "@euroclock.eurospec.internal";
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.error);
    return data;
  },
  signOut: async (token) => {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
    });
  },
  // Send reset email to work email via Supabase
  resetPassword: async (workEmail) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: workEmail })
    });
    return res.ok;
  },
  // Update password using access token
  updatePassword: async (token, newPassword) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword })
    });
    return res.ok;
  }
};

const rpc = async (fn, params) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  return res.ok;
};

// ─── Supabase DB ──────────────────────────────────────────────────────────────
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
    <button onClick={onClick} disabled={loading} className="refresh-btn">
      <span style={{ display:"inline-block", animation: loading ? "spin 0.8s linear infinite" : "none" }}>↻</span>
      <span className="refresh-label">{loading ? "Refreshing..." : "Refresh"}</span>
    </button>
  );
}
function Footer() {
  return (
    <div style={{ textAlign:"right", padding:"12px 16px", fontSize:11, color:"#c4c8d4", letterSpacing:1, borderTop:"1px solid #f0f2f5", marginTop:16 }}>
      Developed by: Eurospec
    </div>
  );
}
function HelpButton({ onClick }) {
  return <button onClick={onClick} className="help-btn">? Help</button>;
}

// ─── Help Modal ───────────────────────────────────────────────────────────────
function HelpModal({ onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:10, width:"100%", maxWidth:680, maxHeight:"90vh", overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ background:"#1a1f2e", borderRadius:"10px 10px 0 0", padding:"20px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:800, color:"#c8a84b" }}>EuroClock <span style={{ color:"#fff" }}>Help Center</span></div>
            <div style={{ fontSize:12, color:"#9aa0b4", marginTop:2 }}>Everything you need to know</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#9aa0b4", fontSize:22, cursor:"pointer", padding:"4px 8px" }}>✕</button>
        </div>
        <div style={{ padding:"20px" }}>
          {[
            { role:"👷 Toolmaker / CNC", color:"#fff8e6", border:"#f0dfa0", steps:["Sign in with your Employee ID and password.","On first login you'll be asked to set a new password.","Select the date and search for your Project Code.","Enter hours. Check R&D if applicable. Add a comment if needed.","Tap Submit. Toolmaker entries go to your supervisor; CNC entries auto-approve."] },
            { role:"👔 Supervisor", color:"#f0faf0", border:"#c0e0c0", steps:["Sign in — you'll set a new password on first login.","Go to Review tab to see pending entries from your team.","Tap ✓ to approve, ✕ to reject, or Edit to fix and approve.","Use Refresh to load new entries without reloading the page.","Forgot your password? Use the Forgot Password link on the login screen."] },
            { role:"💼 Finance", color:"#f0f4ff", border:"#b0c4f0", steps:["Sign in — set a new password on first login.","Use quick filters or custom date range.","Export Epicor CSV downloads in the exact format needed.","Go to Project Codes tab to manage codes for the team.","Forgot password? Use the reset link — it goes to your work email."] },
            { role:"🔧 Admin", color:"#fdf0f0", border:"#f0c0c0", steps:["Add employees with their ID, name, role, and a temporary password.","All employees must change their password on first login.","For supervisors/finance/admin, add their work email for password resets.","Edit passwords anytime — changes sync immediately."] },
          ].map(s => (
            <div key={s.role} style={{ marginBottom:12, background:s.color, border:`1px solid ${s.border}`, borderRadius:8, padding:"12px 16px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#1a1f2e", marginBottom:8 }}>{s.role}</div>
              <ol style={{ paddingLeft:18, margin:0 }}>
                {s.steps.map((step, i) => <li key={i} style={{ fontSize:13, color:"#4a5068", marginBottom:4, lineHeight:1.5 }}>{step}</li>)}
              </ol>
            </div>
          ))}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#c8a84b", marginBottom:10, paddingBottom:6, borderBottom:"2px solid #f0f2f5" }}>FAQ</div>
            {[
              ["Will I be logged out if I refresh?","No — your session persists. You'll only be logged out after 10 minutes of inactivity."],
              ["What is LB vs RD?","LB = regular labour hours. RD = Research & Development. Check the R&D box when logging."],
              ["I forgot my password — what do I do?","On the login screen click Forgot Password. Supervisors/Finance/Admin get a reset email. Toolmakers/CNC ask their admin to reset it."],
              ["What is Date Seq in the export?","Only filled when you log multiple entries for the same project on the same day."],
            ].map(([q, a]) => (
              <div key={q} style={{ marginBottom:10, padding:"10px 14px", background:"#f8f9fc", borderRadius:6, border:"1px solid #e4e7f0" }}>
                <div style={{ fontWeight:600, fontSize:13, color:"#1a1f2e", marginBottom:4 }}>{q}</div>
                <div style={{ fontSize:13, color:"#7a8099", lineHeight:1.5 }}>{a}</div>
              </div>
            ))}
          </div>
          <div style={{ background:"#1a1f2e", borderRadius:8, padding:"18px 20px" }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#c8a84b", marginBottom:12 }}>Contact Us</div>
            <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"#c8a84b", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16, color:"#1a1f2e", flexShrink:0 }}>DC</div>
              <div>
                <div style={{ color:"#fff", fontWeight:600, fontSize:14 }}>{DEV_NAME}</div>
                <div style={{ color:"#9aa0b4", fontSize:12, marginTop:2 }}>EuroClock · Eurospec Tooling & Manufacturing</div>
                <a href={`mailto:${DEV_EMAIL}`} style={{ color:"#c8a84b", fontSize:13, marginTop:4, display:"block", textDecoration:"none" }}>📧 {DEV_EMAIL}</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CHANGE PASSWORD SCREEN ───────────────────────────────────────────────────
function ChangePasswordScreen({ user, onDone, showToast }) {
  const [newPass, setNewPass]     = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState("");
  const [saving, setSaving]       = useState(false);
  const isHigher = HIGHER_ROLES.includes(user.role);

  const submit = async () => {
    setError("");
    if (newPass.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPass !== confirm) { setError("Passwords don't match."); return; }
    setSaving(true);
    try {
      // Use RPC with admin privileges to update encrypted password
      const ok = await rpc("update_employee_password", { emp_id: user.id, new_password: newPass });
      if (!ok) throw new Error("RPC update failed");
      // Update plain text copy in employees table (for admin visibility)
      await db.patch("employees", `id=eq.${user.id}`, { password: newPass, must_change_password: false });
      showToast("Password updated successfully!");
      onDone();
    } catch { setError("Failed to update password. Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-box" style={{ position:"relative", overflow:"hidden" }}>
        {LOGO_URL && <img src={LOGO_URL} alt="Logo" style={{ position:"absolute", top:0, right:0, height:56, objectFit:"contain", borderRadius:"0 8px 0 0", padding:"6px 8px 4px 4px" }} />}
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, letterSpacing:3, textTransform:"uppercase", color:"#1a1f2e", marginBottom:4 }}>
          Euro<span style={{ color:"#c8a84b" }}>Clock</span>
        </div>
        <div style={{ marginBottom:24 }}>
          <div style={{ background:"#fff8e6", border:"1px solid #f0dfa0", borderRadius:6, padding:"12px 14px" }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#b8860b", marginBottom:4 }}>🔐 Set Your Password</div>
            <div style={{ fontSize:13, color:"#7a8099", lineHeight:1.5 }}>
              Welcome, <strong>{user.name}</strong>! This is your first login.
              Please set a personal password to continue.
              {isHigher && <span> Your admin can also send a reset link to your work email if you ever forget it.</span>}
            </div>
          </div>
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group" style={{ marginBottom:14 }}>
          <label className="form-label">New Password</label>
          <input className="form-input" type="password" placeholder="Min 6 characters" value={newPass}
            onChange={e => setNewPass(e.target.value)} style={{ fontSize:16 }} />
        </div>
        <div className="form-group" style={{ marginBottom:24 }}>
          <label className="form-label">Confirm Password</label>
          <input className="form-input" type="password" placeholder="Re-enter password" value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()} style={{ fontSize:16 }} />
        </div>
        <button className="btn btn-primary" style={{ width:"100%", padding:"14px", fontSize:15 }} onClick={submit} disabled={saving}>
          {saving ? "Saving..." : "Set Password & Continue →"}
        </button>
        <div style={{ marginTop:16, padding:"10px 12px", background:"#f8f9fc", borderRadius:6, fontSize:12, color:"#9aa0b4" }}>
          💡 Choose something you'll remember. You can always contact your admin if you get locked out.
        </div>
      </div>
    </div>
  );
}

// ─── FORGOT PASSWORD SCREEN ───────────────────────────────────────────────────
function ForgotPasswordScreen({ onBack }) {
  const [empId, setEmpId]   = useState("");
  const [email, setEmail]   = useState("");
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [mode, setMode]     = useState(null); // "email" or "admin"

  const checkEmployee = async () => {
    setError("");
    if (!empId.trim()) { setError("Please enter your Employee ID."); return; }
    setLoading(true);
    try {
      const rows = await db.get("employees", `id=ilike.${encodeURIComponent(empId.trim())}`);
      if (!rows || rows.length === 0) { setError("Employee not found."); return; }
      const emp = rows[0];
      if (HIGHER_ROLES.includes(emp.role) && emp.work_email) {
        setMode("email");
        setEmail(emp.work_email);
      } else {
        setMode("admin");
      }
    } catch { setError("Connection error. Try again."); }
    finally { setLoading(false); }
  };

  const sendReset = async () => {
    setLoading(true);
    try {
      await auth.resetPassword(email);
      setSent(true);
    } catch { setError("Failed to send reset email. Contact your admin."); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, letterSpacing:3, textTransform:"uppercase", color:"#1a1f2e", marginBottom:20 }}>
          Euro<span style={{ color:"#c8a84b" }}>Clock</span>
        </div>

        {sent ? (
          <div>
            <div style={{ background:"#eaf5ea", border:"1px solid #c0e0c0", borderRadius:8, padding:"16px", marginBottom:20 }}>
              <div style={{ fontWeight:700, color:"#2a8a2a", marginBottom:6 }}>✓ Reset Email Sent</div>
              <div style={{ fontSize:13, color:"#4a5068", lineHeight:1.5 }}>
                A password reset link has been sent to <strong>{email}</strong>. Check your inbox and follow the link to reset your password.
              </div>
            </div>
            <button className="btn btn-primary" style={{ width:"100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        ) : mode === "admin" ? (
          <div>
            <div style={{ background:"#fff8e6", border:"1px solid #f0dfa0", borderRadius:8, padding:"16px", marginBottom:20 }}>
              <div style={{ fontWeight:700, color:"#b8860b", marginBottom:6 }}>Contact Your Admin</div>
              <div style={{ fontSize:13, color:"#4a5068", lineHeight:1.5 }}>
                Password resets for Toolmakers and CNC operators are handled by your Admin. Please ask them to reset your password in the Admin panel.
              </div>
            </div>
            <button className="btn btn-primary" style={{ width:"100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        ) : mode === "email" ? (
          <div>
            <div style={{ fontSize:13, color:"#7a8099", marginBottom:16 }}>
              We'll send a reset link to your work email:
            </div>
            <div style={{ padding:"12px 14px", background:"#f8f9fc", border:"1px solid #e4e7f0", borderRadius:6, marginBottom:20, fontWeight:600, color:"#1a1f2e" }}>
              📧 {email}
            </div>
            {error && <div className="login-error">{error}</div>}
            <button className="btn btn-primary" style={{ width:"100%", padding:"14px", marginBottom:12 }} onClick={sendReset} disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            <button className="btn btn-secondary" style={{ width:"100%" }} onClick={onBack}>Cancel</button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:14, color:"#1a1f2e", marginBottom:16, fontWeight:600 }}>Forgot Password</div>
            <div style={{ fontSize:13, color:"#7a8099", marginBottom:16 }}>Enter your Employee ID and we'll help you reset your password.</div>
            {error && <div className="login-error">{error}</div>}
            <div className="form-group" style={{ marginBottom:16 }}>
              <label className="form-label">Employee ID</label>
              <input className="form-input" placeholder="e.g. E001" value={empId}
                onChange={e => setEmpId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && checkEmployee()}
                style={{ fontSize:16 }} />
            </div>
            <button className="btn btn-primary" style={{ width:"100%", padding:"14px", marginBottom:12 }} onClick={checkEmployee} disabled={loading}>
              {loading ? "Checking..." : "Continue →"}
            </button>
            <button className="btn btn-secondary" style={{ width:"100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PROJECT CODE INPUT ───────────────────────────────────────────────────────
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
        autoComplete="off" style={{ fontSize:16 }}
      />
      {open && matches.length > 0 && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:200, background:"#fff", border:"1px solid #d8dce8", borderRadius:4, boxShadow:"0 4px 12px rgba(0,0,0,0.12)", maxHeight:240, overflowY:"auto" }}>
          {matches.slice(0, 50).map(p => (
            <div key={p.code} onMouseDown={() => select(p.code)} onTouchEnd={() => select(p.code)}
              style={{ padding:"12px 14px", cursor:"pointer", borderBottom:"1px solid #f0f2f5", display:"flex", gap:10, alignItems:"center", minHeight:44 }}
              onMouseEnter={e => e.currentTarget.style.background="#f8f9fc"}
              onMouseLeave={e => e.currentTarget.style.background="#fff"}>
              <span style={{ fontWeight:700, color:"#1a1f2e", fontSize:15 }}>{p.code}</span>
              {p.description && <span style={{ color:"#9aa0b4", fontSize:13 }}>— {p.description}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin, onForgot }) {
  const [empId, setEmpId]       = useState("");
  const [empName, setEmpName]   = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      let resolvedId = empId.trim();
      if (!resolvedId && empName.trim()) {
        const rows = await db.get("employees", `name=ilike.${encodeURIComponent(empName.trim())}`);
        if (!rows || rows.length === 0) { setError("Employee not found."); return; }
        resolvedId = rows[0].id;
        setEmpId(resolvedId);
      }
      if (!resolvedId) { setError("Please enter your Employee ID or name."); return; }
        // Must have a password entered
      if (!password) { setError("Please enter your password."); return; }

      // Load employee profile
      const empRows = await db.get("employees", `id=ilike.${encodeURIComponent(resolvedId)}`);
      if (!empRows || empRows.length === 0) { setError("Employee not found."); return; }
      const emp = empRows[0];

      // Try Supabase Auth first (encrypted), fall back to plain text
      let authToken = null;
      try {
        const authData = await auth.signIn(resolvedId, password);
        authToken = authData.access_token;
      } catch {
        if (!emp.password || emp.password !== password) {
          setError("Incorrect password."); return;
        }
      }

      const user = { id: emp.id, name: emp.name, role: emp.role, supervisor: emp.supervisor, category: emp.category || emp.role, token: authToken, mustChangePassword: emp.must_change_password };
      saveSession(user); onLogin(user);eRef, useCallback } from "react";
import "./App.css";

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://dtnrkerxtjpjfomtotcs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bnJrZXJ4dGpwamZvbXRvdGNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzUzNDIsImV4cCI6MjA5MzgxMTM0Mn0.0bfZaNIOTUcM8EfTwUR-gbESwYkMFBnFj0Kc1NHOUEo";
const LOGO_URL     = "https://eurospectooling.com/wp-content/uploads/2024/03/logo-e1711467462820.png";
const INACTIVITY_MS = 10 * 60 * 1000;
const APP_SLOGAN   = "Log it. Approve it. Export it.";
const DEV_NAME     = "Dhyey Chokshi (Software Developer)";
const DEV_EMAIL    = "dchokshi@eurospectooling.com";
const HIGHER_ROLES = ["supervisor", "finance", "admin"];

// ─── Supabase Auth ────────────────────────────────────────────────────────────
const auth = {
  signIn: async (empId, password) => {
    const email = empId.toLowerCase() + "@euroclock.eurospec.internal";
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.error);
    return data;
  },
  signOut: async (token) => {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
    });
  },
  // Send reset email to work email via Supabase
  resetPassword: async (workEmail) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: workEmail })
    });
    return res.ok;
  },
  // Update password using access token
  updatePassword: async (token, newPassword) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword })
    });
    return res.ok;
  }
};

const rpc = async (fn, params) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  return res.ok;
};

// ─── Supabase DB ──────────────────────────────────────────────────────────────
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
    <button onClick={onClick} disabled={loading} className="refresh-btn">
      <span style={{ display:"inline-block", animation: loading ? "spin 0.8s linear infinite" : "none" }}>↻</span>
      <span className="refresh-label">{loading ? "Refreshing..." : "Refresh"}</span>
    </button>
  );
}
function Footer() {
  return (
    <div style={{ textAlign:"right", padding:"12px 16px", fontSize:11, color:"#c4c8d4", letterSpacing:1, borderTop:"1px solid #f0f2f5", marginTop:16 }}>
      Developed by: Eurospec
    </div>
  );
}
function HelpButton({ onClick }) {
  return <button onClick={onClick} className="help-btn">? Help</button>;
}

// ─── Help Modal ───────────────────────────────────────────────────────────────
function HelpModal({ onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:10, width:"100%", maxWidth:680, maxHeight:"90vh", overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ background:"#1a1f2e", borderRadius:"10px 10px 0 0", padding:"20px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:800, color:"#c8a84b" }}>EuroClock <span style={{ color:"#fff" }}>Help Center</span></div>
            <div style={{ fontSize:12, color:"#9aa0b4", marginTop:2 }}>Everything you need to know</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#9aa0b4", fontSize:22, cursor:"pointer", padding:"4px 8px" }}>✕</button>
        </div>
        <div style={{ padding:"20px" }}>
          {[
            { role:"👷 Toolmaker / CNC", color:"#fff8e6", border:"#f0dfa0", steps:["Sign in with your Employee ID and password.","On first login you'll be asked to set a new password.","Select the date and search for your Project Code.","Enter hours. Check R&D if applicable. Add a comment if needed.","Tap Submit. Toolmaker entries go to your supervisor; CNC entries auto-approve."] },
            { role:"👔 Supervisor", color:"#f0faf0", border:"#c0e0c0", steps:["Sign in — you'll set a new password on first login.","Go to Review tab to see pending entries from your team.","Tap ✓ to approve, ✕ to reject, or Edit to fix and approve.","Use Refresh to load new entries without reloading the page.","Forgot your password? Use the Forgot Password link on the login screen."] },
            { role:"💼 Finance", color:"#f0f4ff", border:"#b0c4f0", steps:["Sign in — set a new password on first login.","Use quick filters or custom date range.","Export Epicor CSV downloads in the exact format needed.","Go to Project Codes tab to manage codes for the team.","Forgot password? Use the reset link — it goes to your work email."] },
            { role:"🔧 Admin", color:"#fdf0f0", border:"#f0c0c0", steps:["Add employees with their ID, name, role, and a temporary password.","All employees must change their password on first login.","For supervisors/finance/admin, add their work email for password resets.","Edit passwords anytime — changes sync immediately."] },
          ].map(s => (
            <div key={s.role} style={{ marginBottom:12, background:s.color, border:`1px solid ${s.border}`, borderRadius:8, padding:"12px 16px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#1a1f2e", marginBottom:8 }}>{s.role}</div>
              <ol style={{ paddingLeft:18, margin:0 }}>
                {s.steps.map((step, i) => <li key={i} style={{ fontSize:13, color:"#4a5068", marginBottom:4, lineHeight:1.5 }}>{step}</li>)}
              </ol>
            </div>
          ))}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#c8a84b", marginBottom:10, paddingBottom:6, borderBottom:"2px solid #f0f2f5" }}>FAQ</div>
            {[
              ["Will I be logged out if I refresh?","No — your session persists. You'll only be logged out after 10 minutes of inactivity."],
              ["What is LB vs RD?","LB = regular labour hours. RD = Research & Development. Check the R&D box when logging."],
              ["I forgot my password — what do I do?","On the login screen click Forgot Password. Supervisors/Finance/Admin get a reset email. Toolmakers/CNC ask their admin to reset it."],
              ["What is Date Seq in the export?","Only filled when you log multiple entries for the same project on the same day."],
            ].map(([q, a]) => (
              <div key={q} style={{ marginBottom:10, padding:"10px 14px", background:"#f8f9fc", borderRadius:6, border:"1px solid #e4e7f0" }}>
                <div style={{ fontWeight:600, fontSize:13, color:"#1a1f2e", marginBottom:4 }}>{q}</div>
                <div style={{ fontSize:13, color:"#7a8099", lineHeight:1.5 }}>{a}</div>
              </div>
            ))}
          </div>
          <div style={{ background:"#1a1f2e", borderRadius:8, padding:"18px 20px" }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#c8a84b", marginBottom:12 }}>Contact Us</div>
            <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"#c8a84b", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16, color:"#1a1f2e", flexShrink:0 }}>DC</div>
              <div>
                <div style={{ color:"#fff", fontWeight:600, fontSize:14 }}>{DEV_NAME}</div>
                <div style={{ color:"#9aa0b4", fontSize:12, marginTop:2 }}>EuroClock · Eurospec Tooling & Manufacturing</div>
                <a href={`mailto:${DEV_EMAIL}`} style={{ color:"#c8a84b", fontSize:13, marginTop:4, display:"block", textDecoration:"none" }}>📧 {DEV_EMAIL}</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CHANGE PASSWORD SCREEN ───────────────────────────────────────────────────
function ChangePasswordScreen({ user, onDone, showToast }) {
  const [newPass, setNewPass]     = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState("");
  const [saving, setSaving]       = useState(false);
  const isHigher = HIGHER_ROLES.includes(user.role);

  const submit = async () => {
    setError("");
    if (newPass.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPass !== confirm) { setError("Passwords don't match."); return; }
    setSaving(true);
    try {
      // Use RPC with admin privileges to update encrypted password
      const ok = await rpc("update_employee_password", { emp_id: user.id, new_password: newPass });
      if (!ok) throw new Error("RPC update failed");
      // Update plain text copy in employees table (for admin visibility)
      await db.patch("employees", `id=eq.${user.id}`, { password: newPass, must_change_password: false });
      showToast("Password updated successfully!");
      onDone();
    } catch { setError("Failed to update password. Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-box" style={{ position:"relative", overflow:"hidden" }}>
        {LOGO_URL && <img src={LOGO_URL} alt="Logo" style={{ position:"absolute", top:0, right:0, height:56, objectFit:"contain", borderRadius:"0 8px 0 0", padding:"6px 8px 4px 4px" }} />}
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, letterSpacing:3, textTransform:"uppercase", color:"#1a1f2e", marginBottom:4 }}>
          Euro<span style={{ color:"#c8a84b" }}>Clock</span>
        </div>
        <div style={{ marginBottom:24 }}>
          <div style={{ background:"#fff8e6", border:"1px solid #f0dfa0", borderRadius:6, padding:"12px 14px" }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#b8860b", marginBottom:4 }}>🔐 Set Your Password</div>
            <div style={{ fontSize:13, color:"#7a8099", lineHeight:1.5 }}>
              Welcome, <strong>{user.name}</strong>! This is your first login.
              Please set a personal password to continue.
              {isHigher && <span> Your admin can also send a reset link to your work email if you ever forget it.</span>}
            </div>
          </div>
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group" style={{ marginBottom:14 }}>
          <label className="form-label">New Password</label>
          <input className="form-input" type="password" placeholder="Min 6 characters" value={newPass}
            onChange={e => setNewPass(e.target.value)} style={{ fontSize:16 }} />
        </div>
        <div className="form-group" style={{ marginBottom:24 }}>
          <label className="form-label">Confirm Password</label>
          <input className="form-input" type="password" placeholder="Re-enter password" value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()} style={{ fontSize:16 }} />
        </div>
        <button className="btn btn-primary" style={{ width:"100%", padding:"14px", fontSize:15 }} onClick={submit} disabled={saving}>
          {saving ? "Saving..." : "Set Password & Continue →"}
        </button>
        <div style={{ marginTop:16, padding:"10px 12px", background:"#f8f9fc", borderRadius:6, fontSize:12, color:"#9aa0b4" }}>
          💡 Choose something you'll remember. You can always contact your admin if you get locked out.
        </div>
      </div>
    </div>
  );
}

// ─── FORGOT PASSWORD SCREEN ───────────────────────────────────────────────────
function ForgotPasswordScreen({ onBack }) {
  const [empId, setEmpId]   = useState("");
  const [email, setEmail]   = useState("");
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [mode, setMode]     = useState(null); // "email" or "admin"

  const checkEmployee = async () => {
    setError("");
    if (!empId.trim()) { setError("Please enter your Employee ID."); return; }
    setLoading(true);
    try {
      const rows = await db.get("employees", `id=ilike.${encodeURIComponent(empId.trim())}`);
      if (!rows || rows.length === 0) { setError("Employee not found."); return; }
      const emp = rows[0];
      if (HIGHER_ROLES.includes(emp.role) && emp.work_email) {
        setMode("email");
        setEmail(emp.work_email);
      } else {
        setMode("admin");
      }
    } catch { setError("Connection error. Try again."); }
    finally { setLoading(false); }
  };

  const sendReset = async () => {
    setLoading(true);
    try {
      await auth.resetPassword(email);
      setSent(true);
    } catch { setError("Failed to send reset email. Contact your admin."); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, letterSpacing:3, textTransform:"uppercase", color:"#1a1f2e", marginBottom:20 }}>
          Euro<span style={{ color:"#c8a84b" }}>Clock</span>
        </div>

        {sent ? (
          <div>
            <div style={{ background:"#eaf5ea", border:"1px solid #c0e0c0", borderRadius:8, padding:"16px", marginBottom:20 }}>
              <div style={{ fontWeight:700, color:"#2a8a2a", marginBottom:6 }}>✓ Reset Email Sent</div>
              <div style={{ fontSize:13, color:"#4a5068", lineHeight:1.5 }}>
                A password reset link has been sent to <strong>{email}</strong>. Check your inbox and follow the link to reset your password.
              </div>
            </div>
            <button className="btn btn-primary" style={{ width:"100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        ) : mode === "admin" ? (
          <div>
            <div style={{ background:"#fff8e6", border:"1px solid #f0dfa0", borderRadius:8, padding:"16px", marginBottom:20 }}>
              <div style={{ fontWeight:700, color:"#b8860b", marginBottom:6 }}>Contact Your Admin</div>
              <div style={{ fontSize:13, color:"#4a5068", lineHeight:1.5 }}>
                Password resets for Toolmakers and CNC operators are handled by your Admin. Please ask them to reset your password in the Admin panel.
              </div>
            </div>
            <button className="btn btn-primary" style={{ width:"100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        ) : mode === "email" ? (
          <div>
            <div style={{ fontSize:13, color:"#7a8099", marginBottom:16 }}>
              We'll send a reset link to your work email:
            </div>
            <div style={{ padding:"12px 14px", background:"#f8f9fc", border:"1px solid #e4e7f0", borderRadius:6, marginBottom:20, fontWeight:600, color:"#1a1f2e" }}>
              📧 {email}
            </div>
            {error && <div className="login-error">{error}</div>}
            <button className="btn btn-primary" style={{ width:"100%", padding:"14px", marginBottom:12 }} onClick={sendReset} disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            <button className="btn btn-secondary" style={{ width:"100%" }} onClick={onBack}>Cancel</button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:14, color:"#1a1f2e", marginBottom:16, fontWeight:600 }}>Forgot Password</div>
            <div style={{ fontSize:13, color:"#7a8099", marginBottom:16 }}>Enter your Employee ID and we'll help you reset your password.</div>
            {error && <div className="login-error">{error}</div>}
            <div className="form-group" style={{ marginBottom:16 }}>
              <label className="form-label">Employee ID</label>
              <input className="form-input" placeholder="e.g. E001" value={empId}
                onChange={e => setEmpId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && checkEmployee()}
                style={{ fontSize:16 }} />
            </div>
            <button className="btn btn-primary" style={{ width:"100%", padding:"14px", marginBottom:12 }} onClick={checkEmployee} disabled={loading}>
              {loading ? "Checking..." : "Continue →"}
            </button>
            <button className="btn btn-secondary" style={{ width:"100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PROJECT CODE INPUT ───────────────────────────────────────────────────────
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
        autoComplete="off" style={{ fontSize:16 }}
      />
      {open && matches.length > 0 && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:200, background:"#fff", border:"1px solid #d8dce8", borderRadius:4, boxShadow:"0 4px 12px rgba(0,0,0,0.12)", maxHeight:240, overflowY:"auto" }}>
          {matches.slice(0, 50).map(p => (
            <div key={p.code} onMouseDown={() => select(p.code)} onTouchEnd={() => select(p.code)}
              style={{ padding:"12px 14px", cursor:"pointer", borderBottom:"1px solid #f0f2f5", display:"flex", gap:10, alignItems:"center", minHeight:44 }}
              onMouseEnter={e => e.currentTarget.style.background="#f8f9fc"}
              onMouseLeave={e => e.currentTarget.style.background="#fff"}>
              <span style={{ fontWeight:700, color:"#1a1f2e", fontSize:15 }}>{p.code}</span>
              {p.description && <span style={{ color:"#9aa0b4", fontSize:13 }}>— {p.description}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin, onForgot }) {
  const [empId, setEmpId]       = useState("");
  const [empName, setEmpName]   = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      let resolvedId = empId.trim();
      if (!resolvedId && empName.trim()) {
        const rows = await db.get("employees", `name=ilike.${encodeURIComponent(empName.trim())}`);
        if (!rows || rows.length === 0) { setError("Employee not found."); return; }
        resolvedId = rows[0].id;
        setEmpId(resolvedId);
      }
      if (!resolvedId) { setError("Please enter your Employee ID or name."); return; }
        // Must have a password entered
      if (!password) { setError("Please enter your password."); return; }

      // Load employee profile
      const rows = await db.get("employees", `id=ilike.${encodeURIComponent(resolvedId)}`);
      if (!rows || rows.length === 0) { setError("Employee not found."); return; }
      const emp = rows[0];

      // Try Supabase Auth (encrypted password), fall back to plain text for employees without auth accounts
      let authToken = null;
      try {
        const authData = await auth.signIn(resolvedId, password);
        authToken = authData.access_token;
      } catch {
        // Auth account doesn't exist — validate plain text password instead
        if (!emp.password || emp.password !== password) {
          setError("Incorrect password."); return;
        }
      }

      const user = { id: emp.id, name: emp.name, role: emp.role, supervisor: emp.supervisor, category: emp.category || emp.role, token: authToken, mustChangePassword: emp.must_change_password };
      saveSession(user); onLogin(user);eRef, useCallback } from "react";
import "./App.css";

// ─── Config ───────────────────────────────────────────────────────────────────
const SUPABASE_URL = "https://dtnrkerxtjpjfomtotcs.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0bnJrZXJ4dGpwamZvbXRvdGNzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzgyMzUzNDIsImV4cCI6MjA5MzgxMTM0Mn0.0bfZaNIOTUcM8EfTwUR-gbESwYkMFBnFj0Kc1NHOUEo";
const LOGO_URL     = "https://eurospectooling.com/wp-content/uploads/2024/03/logo-e1711467462820.png";
const INACTIVITY_MS = 10 * 60 * 1000;
const APP_SLOGAN   = "Log it. Approve it. Export it.";
const DEV_NAME     = "Dhyey Chokshi (Software Developer)";
const DEV_EMAIL    = "dchokshi@eurospectooling.com";
const HIGHER_ROLES = ["supervisor", "finance", "admin"];

// ─── Supabase Auth ────────────────────────────────────────────────────────────
const auth = {
  signIn: async (empId, password) => {
    const email = empId.toLowerCase() + "@euroclock.eurospec.internal";
    const res = await fetch(`${SUPABASE_URL}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error_description || data.error);
    return data;
  },
  signOut: async (token) => {
    await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}` }
    });
  },
  // Send reset email to work email via Supabase
  resetPassword: async (workEmail) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/recover`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ email: workEmail })
    });
    return res.ok;
  },
  // Update password using access token
  updatePassword: async (token, newPassword) => {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
      method: "PUT",
      headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ password: newPassword })
    });
    return res.ok;
  }
};

const rpc = async (fn, params) => {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify(params)
  });
  return res.ok;
};

// ─── Supabase DB ──────────────────────────────────────────────────────────────
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
    <button onClick={onClick} disabled={loading} className="refresh-btn">
      <span style={{ display:"inline-block", animation: loading ? "spin 0.8s linear infinite" : "none" }}>↻</span>
      <span className="refresh-label">{loading ? "Refreshing..." : "Refresh"}</span>
    </button>
  );
}
function Footer() {
  return (
    <div style={{ textAlign:"right", padding:"12px 16px", fontSize:11, color:"#c4c8d4", letterSpacing:1, borderTop:"1px solid #f0f2f5", marginTop:16 }}>
      Developed by: Eurospec
    </div>
  );
}
function HelpButton({ onClick }) {
  return <button onClick={onClick} className="help-btn">? Help</button>;
}

// ─── Help Modal ───────────────────────────────────────────────────────────────
function HelpModal({ onClose }) {
  return (
    <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.45)", zIndex:500, display:"flex", alignItems:"center", justifyContent:"center", padding:12 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background:"#fff", borderRadius:10, width:"100%", maxWidth:680, maxHeight:"90vh", overflow:"auto", boxShadow:"0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ background:"#1a1f2e", borderRadius:"10px 10px 0 0", padding:"20px 24px", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <div>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:20, fontWeight:800, color:"#c8a84b" }}>EuroClock <span style={{ color:"#fff" }}>Help Center</span></div>
            <div style={{ fontSize:12, color:"#9aa0b4", marginTop:2 }}>Everything you need to know</div>
          </div>
          <button onClick={onClose} style={{ background:"transparent", border:"none", color:"#9aa0b4", fontSize:22, cursor:"pointer", padding:"4px 8px" }}>✕</button>
        </div>
        <div style={{ padding:"20px" }}>
          {[
            { role:"👷 Toolmaker / CNC", color:"#fff8e6", border:"#f0dfa0", steps:["Sign in with your Employee ID and password.","On first login you'll be asked to set a new password.","Select the date and search for your Project Code.","Enter hours. Check R&D if applicable. Add a comment if needed.","Tap Submit. Toolmaker entries go to your supervisor; CNC entries auto-approve."] },
            { role:"👔 Supervisor", color:"#f0faf0", border:"#c0e0c0", steps:["Sign in — you'll set a new password on first login.","Go to Review tab to see pending entries from your team.","Tap ✓ to approve, ✕ to reject, or Edit to fix and approve.","Use Refresh to load new entries without reloading the page.","Forgot your password? Use the Forgot Password link on the login screen."] },
            { role:"💼 Finance", color:"#f0f4ff", border:"#b0c4f0", steps:["Sign in — set a new password on first login.","Use quick filters or custom date range.","Export Epicor CSV downloads in the exact format needed.","Go to Project Codes tab to manage codes for the team.","Forgot password? Use the reset link — it goes to your work email."] },
            { role:"🔧 Admin", color:"#fdf0f0", border:"#f0c0c0", steps:["Add employees with their ID, name, role, and a temporary password.","All employees must change their password on first login.","For supervisors/finance/admin, add their work email for password resets.","Edit passwords anytime — changes sync immediately."] },
          ].map(s => (
            <div key={s.role} style={{ marginBottom:12, background:s.color, border:`1px solid ${s.border}`, borderRadius:8, padding:"12px 16px" }}>
              <div style={{ fontSize:13, fontWeight:700, color:"#1a1f2e", marginBottom:8 }}>{s.role}</div>
              <ol style={{ paddingLeft:18, margin:0 }}>
                {s.steps.map((step, i) => <li key={i} style={{ fontSize:13, color:"#4a5068", marginBottom:4, lineHeight:1.5 }}>{step}</li>)}
              </ol>
            </div>
          ))}
          <div style={{ marginBottom:16 }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#c8a84b", marginBottom:10, paddingBottom:6, borderBottom:"2px solid #f0f2f5" }}>FAQ</div>
            {[
              ["Will I be logged out if I refresh?","No — your session persists. You'll only be logged out after 10 minutes of inactivity."],
              ["What is LB vs RD?","LB = regular labour hours. RD = Research & Development. Check the R&D box when logging."],
              ["I forgot my password — what do I do?","On the login screen click Forgot Password. Supervisors/Finance/Admin get a reset email. Toolmakers/CNC ask their admin to reset it."],
              ["What is Date Seq in the export?","Only filled when you log multiple entries for the same project on the same day."],
            ].map(([q, a]) => (
              <div key={q} style={{ marginBottom:10, padding:"10px 14px", background:"#f8f9fc", borderRadius:6, border:"1px solid #e4e7f0" }}>
                <div style={{ fontWeight:600, fontSize:13, color:"#1a1f2e", marginBottom:4 }}>{q}</div>
                <div style={{ fontSize:13, color:"#7a8099", lineHeight:1.5 }}>{a}</div>
              </div>
            ))}
          </div>
          <div style={{ background:"#1a1f2e", borderRadius:8, padding:"18px 20px" }}>
            <div style={{ fontSize:11, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#c8a84b", marginBottom:12 }}>Contact Us</div>
            <div style={{ display:"flex", alignItems:"center", gap:14, flexWrap:"wrap" }}>
              <div style={{ width:44, height:44, borderRadius:"50%", background:"#c8a84b", display:"flex", alignItems:"center", justifyContent:"center", fontWeight:800, fontSize:16, color:"#1a1f2e", flexShrink:0 }}>DC</div>
              <div>
                <div style={{ color:"#fff", fontWeight:600, fontSize:14 }}>{DEV_NAME}</div>
                <div style={{ color:"#9aa0b4", fontSize:12, marginTop:2 }}>EuroClock · Eurospec Tooling & Manufacturing</div>
                <a href={`mailto:${DEV_EMAIL}`} style={{ color:"#c8a84b", fontSize:13, marginTop:4, display:"block", textDecoration:"none" }}>📧 {DEV_EMAIL}</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── CHANGE PASSWORD SCREEN ───────────────────────────────────────────────────
function ChangePasswordScreen({ user, onDone, showToast }) {
  const [newPass, setNewPass]     = useState("");
  const [confirm, setConfirm]     = useState("");
  const [error, setError]         = useState("");
  const [saving, setSaving]       = useState(false);
  const isHigher = HIGHER_ROLES.includes(user.role);

  const submit = async () => {
    setError("");
    if (newPass.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPass !== confirm) { setError("Passwords don't match."); return; }
    setSaving(true);
    try {
      // Use RPC with admin privileges to update encrypted password
      const ok = await rpc("update_employee_password", { emp_id: user.id, new_password: newPass });
      if (!ok) throw new Error("RPC update failed");
      // Update plain text copy in employees table (for admin visibility)
      await db.patch("employees", `id=eq.${user.id}`, { password: newPass, must_change_password: false });
      showToast("Password updated successfully!");
      onDone();
    } catch { setError("Failed to update password. Please try again."); }
    finally { setSaving(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-box" style={{ position:"relative", overflow:"hidden" }}>
        {LOGO_URL && <img src={LOGO_URL} alt="Logo" style={{ position:"absolute", top:0, right:0, height:56, objectFit:"contain", borderRadius:"0 8px 0 0", padding:"6px 8px 4px 4px" }} />}
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, letterSpacing:3, textTransform:"uppercase", color:"#1a1f2e", marginBottom:4 }}>
          Euro<span style={{ color:"#c8a84b" }}>Clock</span>
        </div>
        <div style={{ marginBottom:24 }}>
          <div style={{ background:"#fff8e6", border:"1px solid #f0dfa0", borderRadius:6, padding:"12px 14px" }}>
            <div style={{ fontWeight:700, fontSize:14, color:"#b8860b", marginBottom:4 }}>🔐 Set Your Password</div>
            <div style={{ fontSize:13, color:"#7a8099", lineHeight:1.5 }}>
              Welcome, <strong>{user.name}</strong>! This is your first login.
              Please set a personal password to continue.
              {isHigher && <span> Your admin can also send a reset link to your work email if you ever forget it.</span>}
            </div>
          </div>
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group" style={{ marginBottom:14 }}>
          <label className="form-label">New Password</label>
          <input className="form-input" type="password" placeholder="Min 6 characters" value={newPass}
            onChange={e => setNewPass(e.target.value)} style={{ fontSize:16 }} />
        </div>
        <div className="form-group" style={{ marginBottom:24 }}>
          <label className="form-label">Confirm Password</label>
          <input className="form-input" type="password" placeholder="Re-enter password" value={confirm}
            onChange={e => setConfirm(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()} style={{ fontSize:16 }} />
        </div>
        <button className="btn btn-primary" style={{ width:"100%", padding:"14px", fontSize:15 }} onClick={submit} disabled={saving}>
          {saving ? "Saving..." : "Set Password & Continue →"}
        </button>
        <div style={{ marginTop:16, padding:"10px 12px", background:"#f8f9fc", borderRadius:6, fontSize:12, color:"#9aa0b4" }}>
          💡 Choose something you'll remember. You can always contact your admin if you get locked out.
        </div>
      </div>
    </div>
  );
}

// ─── FORGOT PASSWORD SCREEN ───────────────────────────────────────────────────
function ForgotPasswordScreen({ onBack }) {
  const [empId, setEmpId]   = useState("");
  const [email, setEmail]   = useState("");
  const [sent, setSent]     = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState("");
  const [mode, setMode]     = useState(null); // "email" or "admin"

  const checkEmployee = async () => {
    setError("");
    if (!empId.trim()) { setError("Please enter your Employee ID."); return; }
    setLoading(true);
    try {
      const rows = await db.get("employees", `id=ilike.${encodeURIComponent(empId.trim())}`);
      if (!rows || rows.length === 0) { setError("Employee not found."); return; }
      const emp = rows[0];
      if (HIGHER_ROLES.includes(emp.role) && emp.work_email) {
        setMode("email");
        setEmail(emp.work_email);
      } else {
        setMode("admin");
      }
    } catch { setError("Connection error. Try again."); }
    finally { setLoading(false); }
  };

  const sendReset = async () => {
    setLoading(true);
    try {
      await auth.resetPassword(email);
      setSent(true);
    } catch { setError("Failed to send reset email. Contact your admin."); }
    finally { setLoading(false); }
  };

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:28, fontWeight:800, letterSpacing:3, textTransform:"uppercase", color:"#1a1f2e", marginBottom:20 }}>
          Euro<span style={{ color:"#c8a84b" }}>Clock</span>
        </div>

        {sent ? (
          <div>
            <div style={{ background:"#eaf5ea", border:"1px solid #c0e0c0", borderRadius:8, padding:"16px", marginBottom:20 }}>
              <div style={{ fontWeight:700, color:"#2a8a2a", marginBottom:6 }}>✓ Reset Email Sent</div>
              <div style={{ fontSize:13, color:"#4a5068", lineHeight:1.5 }}>
                A password reset link has been sent to <strong>{email}</strong>. Check your inbox and follow the link to reset your password.
              </div>
            </div>
            <button className="btn btn-primary" style={{ width:"100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        ) : mode === "admin" ? (
          <div>
            <div style={{ background:"#fff8e6", border:"1px solid #f0dfa0", borderRadius:8, padding:"16px", marginBottom:20 }}>
              <div style={{ fontWeight:700, color:"#b8860b", marginBottom:6 }}>Contact Your Admin</div>
              <div style={{ fontSize:13, color:"#4a5068", lineHeight:1.5 }}>
                Password resets for Toolmakers and CNC operators are handled by your Admin. Please ask them to reset your password in the Admin panel.
              </div>
            </div>
            <button className="btn btn-primary" style={{ width:"100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        ) : mode === "email" ? (
          <div>
            <div style={{ fontSize:13, color:"#7a8099", marginBottom:16 }}>
              We'll send a reset link to your work email:
            </div>
            <div style={{ padding:"12px 14px", background:"#f8f9fc", border:"1px solid #e4e7f0", borderRadius:6, marginBottom:20, fontWeight:600, color:"#1a1f2e" }}>
              📧 {email}
            </div>
            {error && <div className="login-error">{error}</div>}
            <button className="btn btn-primary" style={{ width:"100%", padding:"14px", marginBottom:12 }} onClick={sendReset} disabled={loading}>
              {loading ? "Sending..." : "Send Reset Link"}
            </button>
            <button className="btn btn-secondary" style={{ width:"100%" }} onClick={onBack}>Cancel</button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize:14, color:"#1a1f2e", marginBottom:16, fontWeight:600 }}>Forgot Password</div>
            <div style={{ fontSize:13, color:"#7a8099", marginBottom:16 }}>Enter your Employee ID and we'll help you reset your password.</div>
            {error && <div className="login-error">{error}</div>}
            <div className="form-group" style={{ marginBottom:16 }}>
              <label className="form-label">Employee ID</label>
              <input className="form-input" placeholder="e.g. E001" value={empId}
                onChange={e => setEmpId(e.target.value)}
                onKeyDown={e => e.key === "Enter" && checkEmployee()}
                style={{ fontSize:16 }} />
            </div>
            <button className="btn btn-primary" style={{ width:"100%", padding:"14px", marginBottom:12 }} onClick={checkEmployee} disabled={loading}>
              {loading ? "Checking..." : "Continue →"}
            </button>
            <button className="btn btn-secondary" style={{ width:"100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── PROJECT CODE INPUT ───────────────────────────────────────────────────────
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
        autoComplete="off" style={{ fontSize:16 }}
      />
      {open && matches.length > 0 && (
        <div style={{ position:"absolute", top:"100%", left:0, right:0, zIndex:200, background:"#fff", border:"1px solid #d8dce8", borderRadius:4, boxShadow:"0 4px 12px rgba(0,0,0,0.12)", maxHeight:240, overflowY:"auto" }}>
          {matches.slice(0, 50).map(p => (
            <div key={p.code} onMouseDown={() => select(p.code)} onTouchEnd={() => select(p.code)}
              style={{ padding:"12px 14px", cursor:"pointer", borderBottom:"1px solid #f0f2f5", display:"flex", gap:10, alignItems:"center", minHeight:44 }}
              onMouseEnter={e => e.currentTarget.style.background="#f8f9fc"}
              onMouseLeave={e => e.currentTarget.style.background="#fff"}>
              <span style={{ fontWeight:700, color:"#1a1f2e", fontSize:15 }}>{p.code}</span>
              {p.description && <span style={{ color:"#9aa0b4", fontSize:13 }}>— {p.description}</span>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── LOGIN ────────────────────────────────────────────────────────────────────
function Login({ onLogin, onForgot }) {
  const [empId, setEmpId]       = useState("");
  const [empName, setEmpName]   = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const submit = async () => {
    setError(""); setLoading(true);
    try {
      let resolvedId = empId.trim();
      if (!resolvedId && empName.trim()) {
        const rows = await db.get("employees", `name=ilike.${encodeURIComponent(empName.trim())}`);
        if (!rows || rows.length === 0) { setError("Employee not found."); return; }
        resolvedId = rows[0].id;
        setEmpId(resolvedId);
      }
      if (!resolvedId) { setError("Please enter your Employee ID or name."); return; }
      let authData;
      try { authData = await auth.signIn(resolvedId, password); }
      catch { setError("Incorrect password."); return; }
      const rows = await db.get("employees", `id=ilike.${encodeURIComponent(resolvedId)}`);
      if (!rows || rows.length === 0) { setError("Employee not found."); return; }
      const emp = rows[0];
      const user = { id: emp.id, name: emp.name, role: emp.role, supervisor: emp.supervisor, category: emp.category || emp.role, token: authData.access_token, mustChangePassword: emp.must_change_password };
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
      <div className="login-box" style={{ position:"relative", overflow:"hidden" }}>
        {LOGO_URL && <img src={LOGO_URL} alt="Logo" style={{ position:"absolute", top:0, right:0, height:56, objectFit:"contain", borderRadius:"0 8px 0 0", padding:"6px 8px 4px 4px" }} />}
        <div style={{ marginBottom:4 }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:32, fontWeight:800, letterSpacing:3, textTransform:"uppercase", color:"#1a1f2e", lineHeight:1 }}>
            Euro<span style={{ color:"#c8a84b" }}>Clock</span>
          </div>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:11, letterSpacing:2, color:"#9aa0b4", textTransform:"uppercase", marginTop:2 }}>Eurospec Tooling & Manufacturing</div>
        </div>
        <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:12, letterSpacing:2, color:"#9aa0b4", textTransform:"uppercase", marginBottom:24, marginTop:4 }}>{APP_SLOGAN}</div>

        <div style={{ fontSize:15, fontWeight:700, letterSpacing:1, textTransform:"uppercase", color:"#1a1f2e", marginBottom:16 }}>Sign In</div>
        {error && <div className="login-error">{error}</div>}

        <div className="form-group" style={{ marginBottom:12 }}>
          <label className="form-label">Employee ID</label>
          <input className="form-input" placeholder="e.g. E001" value={empId} style={{ fontSize:16 }}
            onChange={e => setEmpId(e.target.value)} onBlur={handleIdBlur} />
        </div>
        <div className="form-group" style={{ marginBottom:12 }}>
          <label className="form-label">— or — Employee Name</label>
          <input className="form-input" placeholder="e.g. Marcus Webb" value={empName} style={{ fontSize:16 }}
            onChange={e => setEmpName(e.target.value)} onBlur={handleNameBlur} />
        </div>
        <div className="form-group" style={{ marginBottom:20 }}>
          <label className="form-label">Password</label>
          <input className="form-input" type="password" placeholder="••••••••" value={password} style={{ fontSize:16 }}
            onChange={e => setPassword(e.target.value)}
            onKeyDown={e => e.key === "Enter" && submit()} />
        </div>
        <button className="btn btn-primary" style={{ width:"100%", padding:"14px", fontSize:15 }} onClick={submit} disabled={loading}>
          {loading ? "Signing in..." : "Sign In →"}
        </button>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:16 }}>
          <button onClick={() => setShowHelp(true)} style={{ background:"transparent", border:"none", color:"#9aa0b4", fontSize:12, cursor:"pointer", letterSpacing:.5 }}>
            Need help?
          </button>
          <button onClick={onForgot} style={{ background:"transparent", border:"none", color:"#c8a84b", fontSize:12, cursor:"pointer", letterSpacing:.5, fontWeight:600 }}>
            Forgot Password
          </button>
        </div>
        <div style={{ marginTop:20, textAlign:"center", fontSize:11, color:"#c4c8d4", letterSpacing:1 }}>
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
      <div className="page-header">
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
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ fontSize:16 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Day</label>
            <div style={{ padding:"11px 12px", background:"#f8f9fc", border:"1px solid #e4e7f0", borderRadius:6, color:"#c8a84b", fontFamily:"'Barlow Condensed',sans-serif", fontWeight:700, letterSpacing:1, fontSize:15 }}>
              {date ? dayOfDate(date) : "—"}
            </div>
          </div>
        </div>

        <div className="card-title" style={{ marginTop:8 }}>Jobs & Hours</div>
        <div className="job-rows">
          {jobs.map(row => (
            <div key={row.id} style={{ background: row.rnd ? "#f0faf0" : "#f8f9fc", border:`1px solid ${row.rnd ? "#c0e0c0" : "#e4e7f0"}`, borderRadius:6, padding:"12px", transition:"background .2s, border-color .2s" }}>
              <div className="job-row-grid">
                <ProjectInput value={row.job} onChange={val => updateRow(row.id, "job", val)} projectCodes={projectCodes} />
                <input className="form-input" type="number" min="0.25" max="24" step="0.25" placeholder="Hrs" value={row.hours} onChange={e => updateRow(row.id, "hours", e.target.value)} style={{ fontSize:16 }} />
                <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                  <label style={{ display:"flex", alignItems:"center", gap:7, cursor:"pointer", userSelect:"none", flex:1 }}>
                    <input type="checkbox" checked={row.rnd} onChange={e => updateRow(row.id, "rnd", e.target.checked)} style={{ accentColor:"#2a8a2a", width:18, height:18 }} />
                    <span style={{ fontSize:12, fontWeight:700, letterSpacing:1.5, padding:"3px 10px", borderRadius:3, whiteSpace:"nowrap", background: row.rnd ? "#eaf5ea" : "#f0f2f5", color: row.rnd ? "#2a8a2a" : "#c4c8d4", border:`1px solid ${row.rnd ? "#c0e0c0" : "#e4e7f0"}` }}>R&D</span>
                  </label>
                  {jobs.length > 1 && <button className="btn-icon" style={{ fontSize:18, padding:"4px 8px", color:"#cc4444" }} onClick={() => removeRow(row.id)}>✕</button>}
                </div>
              </div>
              <input className="form-input" placeholder="Comment (optional)..." value={row.comment} onChange={e => updateRow(row.id, "comment", e.target.value)} style={{ marginTop:8, fontSize:14, color:"#9aa0b4", background:"transparent", borderColor:"#e4e7f0" }} />
            </div>
          ))}
        </div>
        <button className="btn-add" onClick={addRow}>+ Add Another Job</button>

        <div style={{ marginTop:16, background:"#f8f9fc", border:"1px solid #e4e7f0", borderRadius:6, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr" }}>
            {[["Regular", regHrs, "#c8a84b"], ["R&D", rndHrs, "#2a8a2a"], ["Total", totalHrs, "#1a1f2e"]].map(([label, val, color]) => (
              <div key={label} style={{ padding:"10px 12px", borderRight: label !== "Total" ? "1px solid #e4e7f0" : "none" }}>
                <div style={{ fontSize:10, letterSpacing:1, textTransform:"uppercase", color:"#9aa0b4", marginBottom:4 }}>{label} Hrs</div>
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
          <button className="btn btn-primary" onClick={submit} disabled={saving} style={{ padding:"12px 24px", fontSize:15, width:"100%" }}>{saving ? "Submitting..." : "Submit Entry →"}</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">My Recent Entries</div>
        {myEntries.length === 0
          ? <div style={{ color:"#c4c8d4", fontStyle:"italic", fontSize:13 }}>No entries yet.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Date</th><th>Project</th><th>Hrs</th><th>Type</th><th>Status</th></tr></thead>
                <tbody>
                  {myEntries.map(e => (
                    <tr key={e.id}>
                      <td>{e.date}</td>
                      <td style={{ fontWeight:700, color:"#1a1f2e" }}>{e.job}</td>
                      <td>{e.hours}</td>
                      <td>{e.rnd ? <span className="rnd-badge">R&D</span> : <span style={{ color:"#9aa0b4", fontSize:11 }}>Reg</span>}</td>
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
  const [editEntry, setEditEntry]   = useState(null);

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
    await db.patch("entries", `id=eq.${editEntry.id}`, { hours: parseFloat(editEntry.hours), job: editEntry.job, notes: editEntry.notes, status: "approved" });
    setEntries(prev => prev.map(e => e.id === editEntry.id ? { ...e, hours: parseFloat(editEntry.hours), job: editEntry.job, notes: editEntry.notes, status: "approved" } : e));
    showToast("Entry edited and approved.");
    setEditEntry(null);
  };

  const visible = entries.filter(e => filter === "all" || e.status === filter);
  const pending = entries.filter(e => e.status === "pending").length;

  return (
    <div className="page">
      {editEntry && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.4)", zIndex:400, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}>
          <div style={{ background:"#fff", borderRadius:8, width:"100%", maxWidth:480, padding:24, boxShadow:"0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize:16, fontWeight:700, color:"#1a1f2e", marginBottom:4 }}>Edit & Approve Entry</div>
            <div style={{ fontSize:12, color:"#9aa0b4", marginBottom:16 }}>Make corrections then approve.</div>
            <div className="form-group" style={{ marginBottom:12 }}>
              <label className="form-label">Employee</label>
              <input className="form-input" value={editEntry.employee_name} disabled style={{ background:"#f8f9fc", color:"#9aa0b4" }} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Project Code</label>
                <input className="form-input" value={editEntry.job} onChange={e => setEditEntry(p => ({ ...p, job: e.target.value }))} style={{ fontSize:16 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Hours</label>
                <input className="form-input" type="number" min="0.25" max="24" step="0.25" value={editEntry.hours} onChange={e => setEditEntry(p => ({ ...p, hours: e.target.value }))} style={{ fontSize:16 }} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom:16 }}>
              <label className="form-label">Comment</label>
              <input className="form-input" value={editEntry.notes || ""} onChange={e => setEditEntry(p => ({ ...p, notes: e.target.value }))} style={{ fontSize:16 }} />
            </div>
            <div style={{ display:"flex", gap:10, justifyContent:"flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setEditEntry(null)}>Cancel</button>
              <button className="btn btn-success" onClick={saveEdit}>✓ Save & Approve</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Review</div>
          <div className="page-sub">Approve or reject timesheet entries</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
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
                <thead><tr><th>Employee</th><th>Date</th><th>Project</th><th>Hrs</th><th>Type</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>
                  {visible.map(e => (
                    <tr key={e.id}>
                      <td style={{ color:"#1a1f2e" }}>{e.employee_name}</td>
                      <td>{e.date}</td>
                      <td style={{ fontWeight:700, color:"#1a1f2e" }}>{e.job}</td>
                      <td>{e.hours}</td>
                      <td>{e.rnd ? <span className="rnd-badge">R&D</span> : <span style={{ color:"#9aa0b4", fontSize:11 }}>Reg</span>}</td>
                      <td><span className={`pill pill-${e.status}`}>{e.status}</span></td>
                      <td>
                        <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
                          {e.status === "pending" && <>
                            <button className="btn btn-sm btn-success" onClick={() => update(e.id, "approved")} style={{ minHeight:36 }}>✓</button>
                            <button className="btn btn-sm btn-danger" onClick={() => update(e.id, "rejected")} style={{ minHeight:36 }}>✕</button>
                          </>}
                          {(e.status === "pending" || e.status === "rejected") &&
                            <button className="btn btn-sm btn-secondary" onClick={() => setEditEntry({ ...e })} style={{ minHeight:36 }}>Edit</button>}
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
      <div className="page-header">
        <div>
          <div className="page-title">Finance</div>
          <div className="page-sub">Filter and export in Epicor format</div>
        </div>
        <div style={{ display:"flex", gap:8 }}>
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
          <button className="btn btn-sm btn-secondary" onClick={() => { const r = getWeekRange(0);  setFromDate(r.from); setToDate(r.to); }}>This Week</button>
          <button className="btn btn-sm btn-secondary" onClick={() => { const r = getWeekRange(-1); setFromDate(r.from); setToDate(r.to); }}>Last Week</button>
          <button className="btn btn-sm btn-secondary" onClick={() => { const r = getMonthRange(0);  setFromDate(r.from); setToDate(r.to); }}>This Month</button>
          <button className="btn btn-sm btn-secondary" onClick={() => { const r = getMonthRange(-1); setFromDate(r.from); setToDate(r.to); }}>Last Month</button>
          <button className="btn btn-sm btn-secondary" onClick={() => { setFromDate(""); setToDate(""); }}>Clear</button>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">From Date</label>
            <input className="form-input" type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} style={{ fontSize:16 }} />
          </div>
          <div className="form-group">
            <label className="form-label">To Date</label>
            <input className="form-input" type="date" value={toDate} onChange={e => setToDate(e.target.value)} style={{ fontSize:16 }} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Employee</label>
            <input className="form-input" placeholder="Search name..." value={empFilter} onChange={e => setEmpFilter(e.target.value)} style={{ fontSize:16 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Project Code</label>
            <input className="form-input" placeholder="e.g. 2161" value={jobFilter} onChange={e => setJobFilter(e.target.value)} style={{ fontSize:16 }} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={exportCSV} style={{ width:"100%", padding:"13px", fontSize:15, marginTop:4 }}>↓ Export Epicor CSV ({filtered.length} rows)</button>
      </div>

      <div className="card">
        <div className="card-title">Export Preview</div>
        {loading ? <Spinner /> : withSeq.length === 0
          ? <div style={{ color:"#c4c8d4", fontStyle:"italic", fontSize:13 }}>No approved entries match your filters.</div>
          : <div className="table-wrap">
              <table>
                <thead><tr><th>Code</th><th>Date</th><th>Emp</th><th>Seq</th><th>Hrs</th><th>Cost</th><th>Comment</th><th>Plant</th></tr></thead>
                <tbody>
                  {withSeq.map(e => (
                    <tr key={e.id}>
                      <td style={{ fontWeight:700, color:"#1a1f2e" }}>{e.job}</td>
                      <td>{e.date}</td>
                      <td style={{ color:"#9aa0b4" }}>{e.employee_id}</td>
                      <td style={{ textAlign:"center", fontWeight:700, color:"#c8a84b" }}>{e.dateSeq}</td>
                      <td>{e.hours}</td>
                      <td><span style={{ fontSize:11, fontWeight:700, padding:"2px 6px", borderRadius:3, background: e.rnd ? "#eaf5ea" : "#fff8e6", color: e.rnd ? "#2a8a2a" : "#b8860b", border:`1px solid ${e.rnd ? "#c0e0c0" : "#f0dfa0"}` }}>{e.rnd ? "RD" : "LB"}</span></td>
                      <td style={{ color:"#9aa0b4", maxWidth:120, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{e.notes || "—"}</td>
                      <td style={{ color:"#9aa0b4" }}>PET</td>
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
      <div className="page-header">
        <div>
          <div className="page-title">Project Codes</div>
          <div className="page-sub">Manage codes for the team</div>
        </div>
        <HelpButton onClick={onHelp} />
      </div>
      <div className="card">
        <div className="card-title">Add Code</div>
        {error && <div className="login-error" style={{ marginBottom:12 }}>{error}</div>}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Project Code</label>
            <input className="form-input" placeholder="e.g. 2267" value={code} onChange={e => setCode(e.target.value)} style={{ fontSize:16 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" placeholder="e.g. New Mould Assembly" value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} style={{ fontSize:16 }} />
          </div>
        </div>
        <button className="btn btn-primary" onClick={add} style={{ width:"100%", padding:"13px" }}>+ Add Code</button>
      </div>
      <div className="card">
        <div className="card-title">Active Codes ({codes.length})</div>
        {loading ? <Spinner /> :
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Description</th><th></th></tr></thead>
              <tbody>
                {codes.map(p => (
                  <tr key={p.code}>
                    <td style={{ fontWeight:700, fontSize:15, color:"#1a1f2e" }}>{p.code}</td>
                    <td style={{ color:"#4a5068" }}>{p.description || "—"}</td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => remove(p.code)} style={{ minHeight:36 }}>Remove</button></td>
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
  const [form, setForm]           = useState({ id:"", name:"", role:"toolmaker", category:"toolmaker", password:"", supervisor:"", work_email:"" });
  const [editing, setEditing]     = useState(null);
  const [error, setError]         = useState("");
  const [loading, setLoading]     = useState(true);
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    Promise.all([db.get("employees", "order=id.asc"), db.get("entries", "select=employee_id")])
      .then(([emps, ents]) => { setEmployees(emps); setEntries(ents); setLoading(false); });
  }, []);

  const supervisors = employees.filter(e => e.role === "supervisor");
  const isHigherRole = HIGHER_ROLES.includes(form.role);

  const save = async () => {
    setError("");
    if (!form.id || !form.name || !form.password) { setError("ID, Name, and Password are required."); return; }
    if (!editing && employees.find(e => e.id === form.id)) { setError("Employee ID already exists."); return; }
    if (isHigherRole && !form.work_email) { setError("Work email is required for this role."); return; }
    const payload = {
      name: form.name, role: form.role, category: form.category || form.role,
      password: form.password, supervisor: form.supervisor || null,
      auth_email: form.id.toLowerCase() + "@euroclock.eurospec.internal",
      work_email: form.work_email || null,
      must_change_password: true
    };
    if (editing) {
      await db.patch("employees", `id=eq.${editing}`, payload);
      setEmployees(prev => prev.map(e => e.id === editing ? { ...e, ...payload } : e));
      await rpc("update_employee_password", { emp_id: editing, new_password: form.password });
      if (form.work_email) await rpc("link_work_email", { emp_id: editing, emp_work_email: form.work_email });
      showToast("Employee updated — password synced.");
    } else {
      await db.post("employees", { id: form.id, ...payload });
      setEmployees(prev => [...prev, { id: form.id, ...payload }]);
      const ok = await rpc("create_employee_auth_user", { emp_id: form.id, emp_password: form.password });
      if (form.work_email) await rpc("link_work_email", { emp_id: form.id, emp_work_email: form.work_email });
      showToast(ok ? "Employee added — they must set a password on first login." : "Employee added (auth setup failed).");
    }
    setForm({ id:"", name:"", role:"toolmaker", category:"toolmaker", password:"", supervisor:"", work_email:"" });
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
      <div className="page-header">
        <div>
          <div className="page-title">Admin</div>
          <div className="page-sub">Manage employees and access</div>
        </div>
        <HelpButton onClick={onHelp} />
      </div>

      <div className="card">
        <div className="card-title">{editing ? "Edit Employee" : "Add Employee"}</div>
        {error && <div className="login-error" style={{ marginBottom:12 }}>{error}</div>}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Employee ID</label>
            <input className="form-input" placeholder="e.g. E004" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} disabled={!!editing} style={{ fontSize:16 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" placeholder="First Last" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ fontSize:16 }} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, category: e.target.value }))} style={{ fontSize:16 }}>
              <option value="toolmaker">Toolmaker — needs approval</option>
              <option value="cnc">CNC — auto-approved</option>
              <option value="supervisor">Supervisor</option>
              <option value="finance">Finance</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Temp Password (they'll change on first login)</label>
            <input className="form-input" type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ fontSize:16 }} />
          </div>
        </div>
        {isHigherRole && (
          <div className="form-group" style={{ marginBottom:12 }}>
            <label className="form-label">Work Email (for password reset)</label>
            <input className="form-input" type="email" placeholder="name@eurospectooling.com" value={form.work_email} onChange={e => setForm(f => ({ ...f, work_email: e.target.value }))} style={{ fontSize:16 }} />
          </div>
        )}
        {(form.role === "toolmaker" || form.role === "cnc") && (
          <div className="form-group" style={{ marginBottom:12 }}>
            <label className="form-label">Supervisor</label>
            <select className="form-select" value={form.supervisor} onChange={e => setForm(f => ({ ...f, supervisor: e.target.value }))} style={{ fontSize:16 }}>
              <option value="">— Assign Supervisor —</option>
              {supervisors.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
            </select>
          </div>
        )}
        {form.role === "toolmaker" && <div style={{ marginBottom:12, padding:"8px 12px", background:"#fff8e6", border:"1px solid #f0dfa0", borderRadius:4, fontSize:12, color:"#b8860b" }}>Toolmaker entries require supervisor approval.</div>}
        {form.role === "cnc" && <div style={{ marginBottom:12, padding:"8px 12px", background:"#e8f4ff", border:"1px solid #b0d4f0", borderRadius:4, fontSize:12, color:"#2a6a9a" }}>CNC entries are auto-approved.</div>}
        {isHigherRole && <div style={{ marginBottom:12, padding:"8px 12px", background:"#f0f4ff", border:"1px solid #b0c4f0", borderRadius:4, fontSize:12, color:"#2a4a9a" }}>This role can reset their password via email if forgotten.</div>}
        <div style={{ display:"flex", gap:10 }}>
          <button className="btn btn-primary" onClick={save} style={{ flex:1, padding:"13px" }}>{editing ? "Save Changes" : "Add Employee"}</button>
          {editing && <button className="btn btn-secondary" onClick={() => { setEditing(null); setForm({ id:"",name:"",role:"toolmaker",category:"toolmaker",password:"",supervisor:"",work_email:"" }); }}>Cancel</button>}
        </div>
      </div>

      <div className="card">
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:14, paddingBottom:8, borderBottom:"1px solid #e4e7f0" }}>
          <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:13, fontWeight:700, letterSpacing:2, textTransform:"uppercase", color:"#1a1f2e" }}>All Employees ({employees.length})</div>
          <button onClick={() => setShowPasswords(p => !p)} style={{ background:"transparent", border:"1px solid #d8dce8", color:"#7a8099", padding:"5px 12px", borderRadius:4, cursor:"pointer", fontSize:11, fontFamily:"'Barlow Condensed',sans-serif", letterSpacing:1, textTransform:"uppercase" }}>
            {showPasswords ? "🙈 Hide Passwords" : "👁 Show Passwords"}
          </button>
        </div>
        {loading ? <Spinner /> :
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Role</th>{showPasswords && <th>Password</th>}<th>Supervisor</th><th>Must Change</th><th></th></tr></thead>
              <tbody>
                {employees.map(emp => {
                  const sup  = employees.find(e => e.id === emp.supervisor);
                  const role = emp.category || emp.role;
                  return (
                    <tr key={emp.id}>
                      <td style={{ fontWeight:700, color:"#9aa0b4" }}>{emp.id}</td>
                      <td style={{ color:"#1a1f2e" }}>{emp.name}</td>
                      <td><span style={{ fontSize:11, fontWeight:700, letterSpacing:1, textTransform:"uppercase", color: roleColor[role] || "#1a1f2e" }}>{role}</span></td>
                      {showPasswords && <td style={{ fontFamily:"monospace", fontSize:12, color:"#4a5068" }}>{emp.password}</td>}
                      <td style={{ color:"#9aa0b4" }}>{sup ? sup.name : "—"}</td>
                      <td><span style={{ fontSize:11, color: emp.must_change_password ? "#cc4444" : "#2a8a2a" }}>{emp.must_change_password ? "Yes" : "No"}</span></td>
                      <td>
                        <div style={{ display:"flex", gap:6 }}>
                          <button className="btn btn-sm btn-secondary" style={{ minHeight:36 }} onClick={() => { setForm({ id: emp.id, name: emp.name, role: emp.role, category: emp.category || emp.role, password: emp.password, supervisor: emp.supervisor || "", work_email: emp.work_email || "" }); setEditing(emp.id); }}>Edit</button>
                          <button className="btn btn-sm btn-danger" style={{ minHeight:36 }} onClick={() => remove(emp.id)}>Del</button>
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
  const [user,       setUser]      = useState(() => loadSession());
  const [tab,        setTab]       = useState(null);
  const [toast,      setToast]     = useState(null);
  const [showHelp,   setShowHelp]  = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const inactivityTimer            = useRef(null);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  const tabMap = {
    toolmaker:  [{ id:"log",      label:"Log Time"  }],
    cnc:        [{ id:"log",      label:"Log Time"  }],
    supervisor: [{ id:"review",   label:"Review"    }],
    finance:    [{ id:"finance",  label:"Dashboard" }, { id:"projects", label:"Codes" }],
    admin:      [{ id:"admin",    label:"Admin"     }, { id:"finance",  label:"Finance"  }, { id:"projects", label:"Codes" }],
  };

  useEffect(() => { if (user && !tab) setTab(tabMap[user.role]?.[0]?.id || "log"); }, [user]);

  const resetTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(async () => {
      if (user?.token) { try { await auth.signOut(user.token); } catch {} }
      clearSession(); setUser(null); setTab(null);
    }, INACTIVITY_MS);
  }, []);

  useEffect(() => {
    if (!user) return;
    const events = ["mousemove","keydown","click","scroll","touchstart"];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => { events.forEach(e => window.removeEventListener(e, resetTimer)); if (inactivityTimer.current) clearTimeout(inactivityTimer.current); };
  }, [user, resetTimer]);

  const handleLogin = emp => {
    setUser(emp);
    saveSession(emp);
    setTab(tabMap[emp.role]?.[0]?.id || "log");
  };

  const handlePasswordChanged = () => {
    const updated = { ...user, mustChangePassword: false };
    setUser(updated);
    saveSession(updated);
  };

  const handleLogout = async () => {
    if (user?.token) { try { await auth.signOut(user.token); } catch {} }
    clearSession(); setUser(null); setTab(null);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
  };

  // Show forgot password screen
  if (showForgot) return <div className="app"><ForgotPasswordScreen onBack={() => setShowForgot(false)} /></div>;

  // Show login
  if (!user) return <div className="app"><Login onLogin={handleLogin} onForgot={() => setShowForgot(true)} /></div>;

  // Force password change on first login
  if (user.mustChangePassword) {
    return (
      <div className="app">
        <ChangePasswordScreen user={user} onDone={handlePasswordChanged} showToast={showToast} />
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </div>
    );
  }

  const roleTabs = tabMap[user.role] || [];

  return (
    <div className="app">
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <header className="header" style={{ padding:0, paddingRight:14 }}>
        <div style={{ display:"flex", alignItems:"stretch", height:"100%" }}>
          {LOGO_URL && <img src={LOGO_URL} alt="Logo" style={{ height:58, objectFit:"contain", padding:"4px 8px 4px 10px" }} />}
          <div style={{ display:"flex", alignItems:"center" }}>
            <div style={{ fontFamily:"'Barlow Condensed',sans-serif", fontSize:22, fontWeight:800, letterSpacing:2, textTransform:"uppercase", color:"#1a1f2e" }}>
              Euro<span style={{ color:"#c8a84b" }}>Clock</span>
            </div>
          </div>
        </div>
        <div className="header-right">
          <div className="header-user">
            <strong>{user.name}</strong>
            <span className="header-id"> · {user.id}</span>
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
