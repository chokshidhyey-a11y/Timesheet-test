import { useState, useEffect } from "react";
import { db, rpc } from "../lib/db";
import { HIGHER_ROLES } from "../lib/config";
import { Footer } from "./shared/Footer";
import { HelpButton } from "./shared/HelpButton";
import { Spinner } from "./shared/Spinner";

export function AdminView({ showToast, onHelp }) {
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ id: "", name: "", role: "toolmaker", category: "toolmaker", password: "", supervisor: "", work_email: "" });
  const [editing, setEditing] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [showPasswords, setShowPasswords] = useState(false);

  useEffect(() => {
    db.get("employees", "order=id.asc").then(emps => { setEmployees(emps); setLoading(false); });
  }, []);

  const supervisors = employees.filter(e => e.role === "supervisor");
  const isHigherRole = HIGHER_ROLES.includes(form.role);

  const save = async () => {
    setError("");
    if (!form.id || !form.name || !form.password) { setError("ID, Name, and Password are required."); return; }
    if (!editing && employees.find(e => e.id === form.id)) { setError("Employee ID already exists."); return; }
    if (isHigherRole && !form.work_email) { setError("Work email is required for this role."); return; }
    const payload = { name: form.name, role: form.role, category: form.category || form.role, password: form.password, supervisor: form.supervisor || null, auth_email: form.id.toLowerCase() + "@euroclock.eurospec.internal", work_email: form.work_email || null, must_change_password: true };
    if (editing) {
      await db.patch("employees", `id=eq.${editing}`, payload);
      setEmployees(prev => prev.map(e => e.id === editing ? { ...e, ...payload } : e));
      await rpc("update_employee_password", { emp_id: editing, new_password: form.password });
      if (form.work_email) await rpc("link_work_email", { emp_id: editing, emp_work_email: form.work_email });
      showToast("Employee updated.");
    } else {
      await db.post("employees", { id: form.id, ...payload });
      setEmployees(prev => [...prev, { id: form.id, ...payload }]);
      await rpc("create_employee_auth_user", { emp_id: form.id, emp_password: form.password });
      if (form.work_email) await rpc("link_work_email", { emp_id: form.id, emp_work_email: form.work_email });
      showToast("Employee added — they must set a password on first login.");
    }
    setForm({ id: "", name: "", role: "toolmaker", category: "toolmaker", password: "", supervisor: "", work_email: "" });
    setEditing(null);
  };

  const remove = async (id) => {
    await db.delete("employees", `id=eq.${id}`);
    setEmployees(prev => prev.filter(e => e.id !== id));
    showToast("Employee removed.");
  };

  const roleColor = { toolmaker: "#c8a84b", cnc: "#2a7a9a", supervisor: "#2a8a2a", finance: "#7a2a9a", admin: "#cc4444" };

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
        {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Employee ID</label>
            <input className="form-input" placeholder="e.g. E004" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} disabled={!!editing} style={{ fontSize: 16 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" placeholder="First Last" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ fontSize: 16 }} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, category: e.target.value }))} style={{ fontSize: 16 }}>
              <option value="toolmaker">Toolmaker — needs approval</option>
              <option value="cnc">CNC — auto-approved</option>
              <option value="supervisor">Supervisor</option>
              <option value="finance">Finance</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Temp Password</label>
            <input className="form-input" type="text" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} style={{ fontSize: 16 }} />
          </div>
        </div>
        {isHigherRole && (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Work Email (for password reset)</label>
            <input className="form-input" type="email" placeholder="name@eurospectooling.com" value={form.work_email} onChange={e => setForm(f => ({ ...f, work_email: e.target.value }))} style={{ fontSize: 16 }} />
          </div>
        )}
        {(form.role === "toolmaker" || form.role === "cnc") && (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Supervisor</label>
            <select className="form-select" value={form.supervisor} onChange={e => setForm(f => ({ ...f, supervisor: e.target.value }))} style={{ fontSize: 16 }}>
              <option value="">— Assign Supervisor —</option>
              {supervisors.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
            </select>
          </div>
        )}
        {form.role === "toolmaker" && <div style={{ marginBottom: 12, padding: "8px 12px", background: "#fff8e6", border: "1px solid #f0dfa0", borderRadius: 4, fontSize: 13, color: "#b8860b" }}>Toolmaker entries require supervisor approval.</div>}
        {form.role === "cnc" && <div style={{ marginBottom: 12, padding: "8px 12px", background: "#e8f4ff", border: "1px solid #b0d4f0", borderRadius: 4, fontSize: 13, color: "#2a6a9a" }}>CNC entries are auto-approved.</div>}
        {isHigherRole && <div style={{ marginBottom: 12, padding: "8px 12px", background: "#f0f4ff", border: "1px solid #b0c4f0", borderRadius: 4, fontSize: 13, color: "#2a4a9a" }}>This role can reset their password via email.</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={save} style={{ flex: 1, padding: "13px" }}>{editing ? "Save Changes" : "Add Employee"}</button>
          {editing && <button className="btn btn-secondary" onClick={() => { setEditing(null); setForm({ id: "", name: "", role: "toolmaker", category: "toolmaker", password: "", supervisor: "", work_email: "" }); }}>Cancel</button>}
        </div>
      </div>

      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid #e4e7f0" }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#1a1f2e" }}>All Employees ({employees.length})</div>
          <button onClick={() => setShowPasswords(p => !p)} style={{ background: "transparent", border: "1px solid #d8dce8", color: "#4b5563", padding: "5px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>
            {showPasswords ? "🙈 Hide" : "👁 Show Passwords"}
          </button>
        </div>
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Role</th>{showPasswords && <th>Password</th>}<th>Must Change</th><th></th></tr></thead>
              <tbody>
                {employees.map(emp => {
                  const role = emp.category || emp.role;
                  return (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 700, color: "#6b7280" }}>{emp.id}</td>
                      <td style={{ color: "#1a1f2e", fontWeight: 500 }}>{emp.name}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: roleColor[role] || "#1a1f2e" }}>{role}</span></td>
                      {showPasswords && <td style={{ fontFamily: "monospace", fontSize: 13, color: "#374151" }}>{emp.password}</td>}
                      <td><span style={{ fontSize: 12, color: emp.must_change_password ? "#cc4444" : "#2a8a2a" }}>{emp.must_change_password ? "Yes" : "No"}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-sm btn-secondary" style={{ minHeight: 36 }} onClick={() => { setForm({ id: emp.id, name: emp.name, role: emp.role, category: emp.category || emp.role, password: emp.password || "", supervisor: emp.supervisor || "", work_email: emp.work_email || "" }); setEditing(emp.id); }}>Edit</button>
                          <button className="btn btn-sm btn-danger" style={{ minHeight: 36 }} onClick={() => remove(emp.id)}>Del</button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
