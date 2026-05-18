import { DEV_NAME, DEV_EMAIL } from "../../lib/config";

export function HelpModal({ onClose }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: 12 }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{ background: "#fff", borderRadius: 10, width: "100%", maxWidth: 680, maxHeight: "90vh", overflow: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
        <div style={{ background: "#1a1f2e", borderRadius: "10px 10px 0 0", padding: "20px 24px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 20, fontWeight: 800, color: "#c8a84b" }}>EuroClock <span style={{ color: "#fff" }}>Help Center</span></div>
            <div style={{ fontSize: 13, color: "#9aa0b4", marginTop: 2 }}>Everything you need to know</div>
          </div>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#9aa0b4", fontSize: 22, cursor: "pointer", padding: "4px 8px" }}>✕</button>
        </div>
        <div style={{ padding: "20px" }}>
          {[
            { role: "👷 Toolmaker / CNC", color: "#fff8e6", border: "#f0dfa0", steps: ["Sign in with your Employee ID and password.", "On first login you'll be asked to set a new password.", "Search for your Project Code, enter hours, check R&D if needed.", "Tap Submit. Toolmaker entries go to your supervisor; CNC entries auto-approve.", "You can edit or delete your own pending entries from the Recent Entries table."] },
            { role: "👔 Supervisor", color: "#f0faf0", border: "#c0e0c0", steps: ["Sign in and go to Review tab.", "Tap ✓ to approve, ✕ to reject (with confirmation), or Edit to fix and approve.", "Use Refresh to load new entries.", "Forgot password? Use the Forgot Password link on login."] },
            { role: "💼 Finance", color: "#f0f4ff", border: "#b0c4f0", steps: ["Use quick filters or custom date range.", "Export Epicor CSV in the exact format needed.", "Go to Project Codes tab to manage codes.", "Forgot password? Reset link goes to your work email."] },
            { role: "🔧 Admin", color: "#fdf0f0", border: "#f0c0c0", steps: ["Add employees with ID, name, role, and a temporary password.", "All employees must change password on first login.", "Add work email for supervisors/finance/admin for password resets."] },
          ].map(s => (
            <div key={s.role} style={{ marginBottom: 12, background: s.color, border: `1px solid ${s.border}`, borderRadius: 8, padding: "12px 16px" }}>
              <div style={{ fontSize: 14, fontWeight: 700, color: "#1a1f2e", marginBottom: 8 }}>{s.role}</div>
              <ol style={{ paddingLeft: 18, margin: 0 }}>
                {s.steps.map((step, i) => <li key={i} style={{ fontSize: 14, color: "#374151", marginBottom: 4, lineHeight: 1.5 }}>{step}</li>)}
              </ol>
            </div>
          ))}
          {[
            ["Will I be logged out if I refresh?", "No — your session persists. You'll only be logged out after 10 minutes of inactivity."],
            ["What is LB vs RD?", "LB = regular labour hours. RD = Research & Development. Check the R&D box when logging."],
            ["I forgot my password", "Toolmakers/CNC — ask your admin to reset it. Supervisors/Finance/Admin — use Forgot Password on the login screen."],
          ].map(([q, a]) => (
            <div key={q} style={{ marginBottom: 10, padding: "10px 14px", background: "#f8f9fc", borderRadius: 6, border: "1px solid #e4e7f0" }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: "#1a1f2e", marginBottom: 4 }}>{q}</div>
              <div style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.5 }}>{a}</div>
            </div>
          ))}
          <div style={{ background: "#1a1f2e", borderRadius: 8, padding: "18px 20px" }}>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#c8a84b", marginBottom: 12 }}>Contact Us</div>
            <div style={{ display: "flex", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: "#c8a84b", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 16, color: "#1a1f2e", flexShrink: 0 }}>DC</div>
              <div>
                <div style={{ color: "#fff", fontWeight: 600, fontSize: 14 }}>{DEV_NAME}</div>
                <div style={{ color: "#9aa0b4", fontSize: 13, marginTop: 2 }}>EuroClock · Eurospec Tooling & Manufacturing</div>
                <a href={`mailto:${DEV_EMAIL}`} style={{ color: "#c8a84b", fontSize: 13, marginTop: 4, display: "block", textDecoration: "none" }}>📧 {DEV_EMAIL}</a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
