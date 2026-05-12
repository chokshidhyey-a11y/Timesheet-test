import { useState } from "react";
import { db, auth } from "../lib/db";
import { saveSession } from "../lib/utils";
import { LOGO_URL, APP_SLOGAN } from "../lib/config";
import { HelpModal } from "./shared/HelpModal";

export function Login({ onLogin, onForgot }) {
  const [empId, setEmpId] = useState("");
  const [empName, setEmpName] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showHelp, setShowHelp] = useState(false);

  const submit = async () => {
    setError("");
    if (!password) { setError("Please enter your password."); return; }
    setLoading(true);
    try {
      let resolvedId = empId.trim();
      if (!resolvedId && empName.trim()) {
        const r = await db.get("employees", `name=ilike.${encodeURIComponent(empName.trim())}`);
        if (!r || r.length === 0) { setError("Employee not found."); return; }
        resolvedId = r[0].id;
        setEmpId(resolvedId);
      }
      if (!resolvedId) { setError("Please enter your Employee ID or name."); return; }

      const empRows = await db.get("employees", `id=ilike.${encodeURIComponent(resolvedId)}`);
      if (!empRows || empRows.length === 0) { setError("Employee not found."); return; }
      const emp = empRows[0];

      let authToken = null;
      try {
        const authData = await auth.signIn(resolvedId, password, emp.work_email || null);
        authToken = authData.access_token;
      } catch (authErr) {
        if (authErr.message === "NO_AUTH_USER") {
          setError("Account not set up. Please contact your admin."); return;
        }
        setError("Incorrect password."); return;
      }

      const user = { id: emp.id, name: emp.name, role: emp.role, supervisor: emp.supervisor, category: emp.category || emp.role, token: authToken, mustChangePassword: emp.must_change_password };
      saveSession(user);
      onLogin(user);
    } catch {
      setError("Connection error. Please try again.");
    } finally {
      setLoading(false);
    }
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
      <div className="login-box" style={{ position: "relative", overflow: "hidden" }}>
        {LOGO_URL && <img src={LOGO_URL} alt="Logo" style={{ position: "absolute", top: 0, right: 0, height: 56, objectFit: "contain", borderRadius: "0 8px 0 0", padding: "6px 8px 4px 4px" }} />}
        <div style={{ marginBottom: 4 }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 32, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: "#1a1f2e", lineHeight: 1 }}>Euro<span style={{ color: "#c8a84b" }}>Clock</span></div>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 11, letterSpacing: 2, color: "#6b7280", textTransform: "uppercase", marginTop: 2 }}>Eurospec Tooling & Manufacturing</div>
        </div>
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 12, letterSpacing: 2, color: "#6b7280", textTransform: "uppercase", marginBottom: 24, marginTop: 4 }}>{APP_SLOGAN}</div>
        <div style={{ fontSize: 15, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: "#1a1f2e", marginBottom: 16 }}>Sign In</div>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">Employee ID</label>
          <input className="form-input" placeholder="e.g. E001" value={empId} style={{ fontSize: 16 }} onChange={e => setEmpId(e.target.value)} onBlur={handleIdBlur} />
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label className="form-label">— or — Employee Name</label>
          <input className="form-input" placeholder="e.g. Marcus Webb" value={empName} style={{ fontSize: 16 }} onChange={e => setEmpName(e.target.value)} onBlur={handleNameBlur} />
        </div>
        <div className="form-group" style={{ marginBottom: 20 }}>
          <label className="form-label">Password</label>
          <input className="form-input" type="password" placeholder="••••••••" value={password} style={{ fontSize: 16 }} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} />
        </div>
        <button className="btn btn-primary" style={{ width: "100%", padding: "14px", fontSize: 15 }} onClick={submit} disabled={loading}>{loading ? "Signing in..." : "Sign In →"}</button>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 16 }}>
          <button onClick={() => setShowHelp(true)} style={{ background: "transparent", border: "none", color: "#6b7280", fontSize: 13, cursor: "pointer" }}>Need help?</button>
          <button onClick={onForgot} style={{ background: "transparent", border: "none", color: "#c8a84b", fontSize: 13, cursor: "pointer", fontWeight: 600 }}>Forgot Password</button>
        </div>
        <div style={{ marginTop: 20, textAlign: "center", fontSize: 12, color: "#9aa0b4", letterSpacing: 1 }}>Developed by: Eurospec</div>
      </div>
    </div>
  );
}
