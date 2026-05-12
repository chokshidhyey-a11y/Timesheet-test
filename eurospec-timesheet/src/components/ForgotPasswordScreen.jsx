import { useState } from "react";
import { db, auth } from "../lib/db";
import { LOGO_URL, HIGHER_ROLES } from "../lib/config";

export function ForgotPasswordScreen({ onBack }) {
  const [empId, setEmpId] = useState("");
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [mode, setMode] = useState(null);

  const checkEmployee = async () => {
    setError("");
    if (!empId.trim()) { setError("Please enter your Employee ID."); return; }
    setLoading(true);
    try {
      const rows = await db.get("employees", `id=ilike.${encodeURIComponent(empId.trim())}`);
      if (!rows || rows.length === 0) { setError("Employee not found."); return; }
      const emp = rows[0];
      if (HIGHER_ROLES.includes(emp.role) && emp.work_email) {
        setMode("email"); setEmail(emp.work_email);
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
        {LOGO_URL && <img src={LOGO_URL} alt="Logo" style={{ position: "absolute", top: 0, right: 0, height: 56, objectFit: "contain", borderRadius: "0 8px 0 0", padding: "6px 8px 4px 4px" }} />}
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: "#1a1f2e", marginBottom: 20 }}>
          Euro<span style={{ color: "#c8a84b" }}>Clock</span>
        </div>
        {sent ? (
          <div>
            <div style={{ background: "#eaf5ea", border: "1px solid #c0e0c0", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: "#2a8a2a", marginBottom: 6 }}>✓ Reset Email Sent</div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>A password reset link has been sent to <strong>{email}</strong>.</div>
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        ) : mode === "admin" ? (
          <div>
            <div style={{ background: "#fff8e6", border: "1px solid #f0dfa0", borderRadius: 8, padding: 16, marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: "#b8860b", marginBottom: 6 }}>Contact Your Admin</div>
              <div style={{ fontSize: 14, color: "#374151", lineHeight: 1.5 }}>Password resets for Toolmakers and CNC operators are handled by your Admin.</div>
            </div>
            <button className="btn btn-primary" style={{ width: "100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        ) : mode === "email" ? (
          <div>
            <div style={{ fontSize: 14, color: "#4b5563", marginBottom: 16 }}>We'll send a reset link to your work email:</div>
            <div style={{ padding: "12px 14px", background: "#f8f9fc", border: "1px solid #e4e7f0", borderRadius: 6, marginBottom: 20, fontWeight: 600, color: "#1a1f2e" }}>📧 {email}</div>
            {error && <div className="login-error">{error}</div>}
            <button className="btn btn-primary" style={{ width: "100%", padding: "14px", marginBottom: 12 }} onClick={sendReset} disabled={loading}>{loading ? "Sending..." : "Send Reset Link"}</button>
            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={onBack}>Cancel</button>
          </div>
        ) : (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "#1a1f2e", marginBottom: 16 }}>Forgot Password</div>
            <div style={{ fontSize: 14, color: "#4b5563", marginBottom: 16 }}>Enter your Employee ID and we'll help you reset your password.</div>
            {error && <div className="login-error">{error}</div>}
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Employee ID</label>
              <input className="form-input" placeholder="e.g. E001" value={empId} onChange={e => setEmpId(e.target.value)} onKeyDown={e => e.key === "Enter" && checkEmployee()} style={{ fontSize: 16 }} />
            </div>
            <button className="btn btn-primary" style={{ width: "100%", padding: "14px", marginBottom: 12 }} onClick={checkEmployee} disabled={loading}>{loading ? "Checking..." : "Continue →"}</button>
            <button className="btn btn-secondary" style={{ width: "100%" }} onClick={onBack}>Back to Sign In</button>
          </div>
        )}
      </div>
    </div>
  );
}
