import { useState } from "react";
import { db, rpc } from "../lib/db";
import { LOGO_URL } from "../lib/config";

export function ChangePasswordScreen({ user, onDone, showToast }) {
  const [newPass, setNewPass] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    setError("");
    if (newPass.length < 6) { setError("Password must be at least 6 characters."); return; }
    if (newPass !== confirm) { setError("Passwords don't match."); return; }
    setSaving(true);
    try {
      const ok = await rpc("update_employee_password", { emp_id: user.id, new_password: newPass });
      if (!ok) throw new Error("failed");
      await db.patch("employees", `id=eq.${user.id}`, { password: newPass, must_change_password: false });
      showToast("Password set successfully!");
      onDone();
    } catch {
      setError("Failed to update password. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="login-wrap">
      <div className="login-box" style={{ position: "relative", overflow: "hidden" }}>
        {LOGO_URL && <img src={LOGO_URL} alt="Logo" style={{ position: "absolute", top: 0, right: 0, height: 56, objectFit: "contain", borderRadius: "0 8px 0 0", padding: "6px 8px 4px 4px" }} />}
        <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 28, fontWeight: 800, letterSpacing: 3, textTransform: "uppercase", color: "#1a1f2e", marginBottom: 16 }}>
          Euro<span style={{ color: "#c8a84b" }}>Clock</span>
        </div>
        <div style={{ background: "#fff8e6", border: "1px solid #f0dfa0", borderRadius: 6, padding: "12px 14px", marginBottom: 20 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "#b8860b", marginBottom: 4 }}>🔐 Set Your Password</div>
          <div style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.5 }}>Welcome, <strong>{user.name}</strong>! Please set a personal password to continue.</div>
        </div>
        {error && <div className="login-error">{error}</div>}
        <div className="form-group" style={{ marginBottom: 14 }}>
          <label className="form-label">New Password</label>
          <input className="form-input" type="password" placeholder="Min 6 characters" value={newPass} onChange={e => setNewPass(e.target.value)} style={{ fontSize: 16 }} />
        </div>
        <div className="form-group" style={{ marginBottom: 24 }}>
          <label className="form-label">Confirm Password</label>
          <input className="form-input" type="password" placeholder="Re-enter password" value={confirm} onChange={e => setConfirm(e.target.value)} onKeyDown={e => e.key === "Enter" && submit()} style={{ fontSize: 16 }} />
        </div>
        <button className="btn btn-primary" style={{ width: "100%", padding: "14px", fontSize: 15 }} onClick={submit} disabled={saving}>
          {saving ? "Saving..." : "Set Password & Continue →"}
        </button>
      </div>
    </div>
  );
}
