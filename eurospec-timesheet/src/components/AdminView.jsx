import { useState, useEffect } from "react";
import { db, rpc } from "../lib/db";
import { uid, today } from "../lib/utils";
import { buildAIContext } from "../lib/ai";
import { HIGHER_ROLES } from "../lib/config";
import { Footer } from "./shared/Footer";
import { HelpButton } from "./shared/HelpButton";
import { Spinner } from "./shared/Spinner";

const roleColor = { toolmaker: "#c8a84b", cnc: "#2a7a9a", new_tooling: "#7a5a2a", supervisor: "#2a8a2a", finance: "#7a2a9a", admin: "#cc4444" };
const displayCat = (cat) => (cat || "").replace("_auto", "");
const isAutoEmp = (emp) => (emp.category === "cnc") || (emp.category || "").endsWith("_auto");
const WORK_ROLE_TYPES = ["toolmaker", "cnc", "new_tooling", "all"];

export function AdminView({ showToast, onHelp }) {
  // ── Employee state ──────────────────────────────────────────────────────────
  const [employees, setEmployees] = useState([]);
  const [form, setForm] = useState({ id: "", name: "", role: "toolmaker", password: "", supervisor: "", work_email: "", autoApprove: false });
  const [editing, setEditing] = useState(null);
  const [empError, setEmpError] = useState("");
  const [empLoading, setEmpLoading] = useState(true);
  const [showPasswords, setShowPasswords] = useState(false);

  // ── Entry state ─────────────────────────────────────────────────────────────
  const [entries, setEntries] = useState([]);
  const [projectCodes, setProjectCodes] = useState([]);
  const [entriesLoading, setEntriesLoading] = useState(true);
  const [entryFilter, setEntryFilter] = useState("all");
  const [entrySearch, setEntrySearch] = useState("");
  const [deleteTarget, setDeleteTarget] = useState(null);

  // ── Work types state ────────────────────────────────────────────────────────
  const [workTypes, setWorkTypes] = useState([]);
  const [wtForm, setWtForm] = useState({ label: "", roleType: "all" });
  const [wtEditing, setWtEditing] = useState(null);
  const [wtError, setWtError] = useState("");

  // ── AI state ────────────────────────────────────────────────────────────────
  const [aiNotes, setAiNotes] = useState(() => localStorage.getItem("es_ai_notes") || "");
  const [showAIContext, setShowAIContext] = useState(false);

  useEffect(() => {
    db.get("employees", "order=id.asc").then(emps => { setEmployees(emps || []); setEmpLoading(false); });
    db.get("entries", "order=date.desc,created_at.desc").then(ents => { setEntries(ents || []); setEntriesLoading(false); });
    db.get("project_codes", "order=code.asc").then(pcs => setProjectCodes(pcs || []));
    db.get("work_types", "order=role_type.asc,order_index.asc,label.asc")
      .then(wts => { if (Array.isArray(wts)) setWorkTypes(wts); })
      .catch(() => {});
  }, []);

  // ── Employee actions ────────────────────────────────────────────────────────
  const supervisors = employees.filter(e => e.role === "supervisor");
  const isHigherRole = HIGHER_ROLES.includes(form.role);
  const needsApprovalToggle = form.role === "toolmaker" || form.role === "new_tooling";

  const save = async () => {
    setEmpError("");
    if (!form.id || !form.name || !form.password) { setEmpError("ID, Name, and Password are required."); return; }
    if (!editing && employees.find(e => e.id === form.id)) { setEmpError("Employee ID already exists."); return; }
    if (isHigherRole && !form.work_email) { setEmpError("Work email is required for this role."); return; }
    const computedCategory = needsApprovalToggle && form.autoApprove ? `${form.role}_auto` : form.role;
    const payload = { name: form.name, role: form.role, category: computedCategory, password: form.password, supervisor: form.supervisor || null, auth_email: form.id.toLowerCase() + "@euroclock.eurospec.internal", work_email: form.work_email || null, must_change_password: true };
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
    setForm({ id: "", name: "", role: "toolmaker", password: "", supervisor: "", work_email: "", autoApprove: false });
    setEditing(null);
  };

  const removeEmp = async (id) => {
    await db.delete("employees", `id=eq.${id}`);
    setEmployees(prev => prev.filter(e => e.id !== id));
    showToast("Employee removed.");
  };

  // ── Entry actions ───────────────────────────────────────────────────────────
  const deleteEntry = async () => {
    if (!deleteTarget) return;
    await db.delete("entries", `id=eq.${deleteTarget.id}`);
    setEntries(prev => prev.filter(e => e.id !== deleteTarget.id));
    showToast("Entry permanently deleted.");
    setDeleteTarget(null);
  };

  const visibleEntries = entries
    .filter(e => entryFilter === "all" || e.status === entryFilter)
    .filter(e => !entrySearch.trim() || e.employee_name?.toLowerCase().includes(entrySearch.toLowerCase()) || e.job?.toLowerCase().includes(entrySearch.toLowerCase()));

  // ── Work type actions ───────────────────────────────────────────────────────
  const saveWT = async () => {
    setWtError("");
    if (!wtForm.label.trim()) { setWtError("Label is required."); return; }
    const body = { label: wtForm.label.trim(), role_type: wtForm.roleType, order_index: 0 };
    if (wtEditing) {
      await db.patch("work_types", `id=eq.${wtEditing}`, body);
      setWorkTypes(prev => prev.map(wt => wt.id === wtEditing ? { ...wt, ...body } : wt));
      showToast("Work type updated.");
    } else {
      const res = await db.post("work_types", body);
      const created = Array.isArray(res) ? res[0] : null;
      if (created) setWorkTypes(prev => [...prev, created]);
      else { showToast("Failed — see SQL setup note.", "error"); return; }
      showToast("Work type added.");
    }
    setWtForm({ label: "", roleType: "all" });
    setWtEditing(null);
  };

  const deleteWT = async (id) => {
    await db.delete("work_types", `id=eq.${id}`);
    setWorkTypes(prev => prev.filter(wt => wt.id !== id));
    showToast("Work type removed.");
  };

  // ── AI context ──────────────────────────────────────────────────────────────
  const approvedEntries = entries.filter(e => e.status === "approved");
  const aiContextText = buildAIContext(approvedEntries, projectCodes, aiNotes);

  const saveAiNotes = () => {
    localStorage.setItem("es_ai_notes", aiNotes);
    showToast("AI training notes saved — will apply to all future AI questions.");
  };

  const clearAiNotes = () => {
    localStorage.removeItem("es_ai_notes");
    setAiNotes("");
    showToast("AI training notes cleared.");
  };

  return (
    <div className="page">
      {/* ── Delete entry confirmation ── */}
      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 8, width: "100%", maxWidth: 420, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.18)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#cc4444", marginBottom: 8 }}>Permanently Delete Entry?</div>
            <div style={{ fontSize: 14, color: "#4b5563", lineHeight: 1.7, marginBottom: 6 }}>
              <strong>{deleteTarget.employee_name}</strong> · {deleteTarget.date}<br />
              <strong>{deleteTarget.hours} hrs</strong> on <strong>{deleteTarget.job}</strong>
              {deleteTarget.notes && <><br /><span style={{ color: "#6b7280" }}>"{deleteTarget.notes}"</span></>}
            </div>
            <div style={{ padding: "8px 12px", background: "#fff0f0", border: "1px solid #f0c0c0", borderRadius: 4, fontSize: 13, color: "#cc4444", marginBottom: 20 }}>This is permanent and cannot be undone.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ background: "#fff0f0" }} onClick={deleteEntry}>Delete Permanently</button>
            </div>
          </div>
        </div>
      )}

      <div className="page-header">
        <div>
          <div className="page-title">Admin</div>
          <div className="page-sub">Manage employees, entries, work types, and AI</div>
        </div>
        <HelpButton onClick={onHelp} />
      </div>

      {/* ── Add / Edit employee ── */}
      <div className="card">
        <div className="card-title">{editing ? "Edit Employee" : "Add Employee"}</div>
        {empError && <div className="login-error" style={{ marginBottom: 12 }}>{empError}</div>}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Employee ID</label>
            <input className="form-input" placeholder="e.g. 9999" value={form.id} onChange={e => setForm(f => ({ ...f, id: e.target.value }))} disabled={!!editing} style={{ fontSize: 16 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Full Name</label>
            <input className="form-input" placeholder="First Last" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} style={{ fontSize: 16 }} />
          </div>
        </div>
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Role</label>
            <select className="form-select" value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value, autoApprove: false }))} style={{ fontSize: 16 }}>
              <option value="toolmaker">Toolmaker — needs approval</option>
              <option value="new_tooling">New Tooling — needs approval</option>
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
        {(form.role === "toolmaker" || form.role === "new_tooling" || form.role === "cnc") && (
          <div className="form-group" style={{ marginBottom: 12 }}>
            <label className="form-label">Supervisor</label>
            <select className="form-select" value={form.supervisor} onChange={e => setForm(f => ({ ...f, supervisor: e.target.value }))} style={{ fontSize: 16 }}>
              <option value="">— Assign Supervisor —</option>
              {supervisors.map(s => <option key={s.id} value={s.id}>{s.name} ({s.id})</option>)}
            </select>
          </div>
        )}
        {needsApprovalToggle && (
          <div style={{ marginBottom: 12, padding: "10px 12px", background: form.autoApprove ? "#f0faf0" : "#fff8e6", border: `1px solid ${form.autoApprove ? "#c0e0c0" : "#f0dfa0"}`, borderRadius: 6 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer", userSelect: "none" }}>
              <input type="checkbox" checked={form.autoApprove} onChange={e => setForm(f => ({ ...f, autoApprove: e.target.checked }))} style={{ accentColor: "#2a8a2a", width: 18, height: 18 }} />
              <div>
                <div style={{ fontSize: 14, fontWeight: 600, color: "#1a1f2e" }}>Auto-approve hours</div>
                <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>{form.autoApprove ? "Hours will be approved immediately — no supervisor review needed." : "Hours require supervisor approval before being recorded."}</div>
              </div>
            </label>
          </div>
        )}
        {form.role === "cnc" && <div style={{ marginBottom: 12, padding: "8px 12px", background: "#e8f4ff", border: "1px solid #b0d4f0", borderRadius: 4, fontSize: 13, color: "#2a6a9a" }}>CNC entries are always auto-approved.</div>}
        {isHigherRole && <div style={{ marginBottom: 12, padding: "8px 12px", background: "#f0f4ff", border: "1px solid #b0c4f0", borderRadius: 4, fontSize: 13, color: "#2a4a9a" }}>This role can reset their password via email.</div>}
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={save} style={{ flex: 1, padding: "13px" }}>{editing ? "Save Changes" : "Add Employee"}</button>
          {editing && <button className="btn btn-secondary" onClick={() => { setEditing(null); setForm({ id: "", name: "", role: "toolmaker", password: "", supervisor: "", work_email: "", autoApprove: false }); }}>Cancel</button>}
        </div>
      </div>

      {/* ── Employee list ── */}
      <div className="card">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid #e4e7f0" }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#1a1f2e" }}>All Employees ({employees.length})</div>
          <button onClick={() => setShowPasswords(p => !p)} style={{ background: "transparent", border: "1px solid #d8dce8", color: "#4b5563", padding: "5px 12px", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1, textTransform: "uppercase" }}>
            {showPasswords ? "🙈 Hide" : "👁 Show Passwords"}
          </button>
        </div>
        {empLoading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>ID</th><th>Name</th><th>Role</th><th>Approval</th>{showPasswords && <th>Password</th>}<th>Must Change</th><th></th></tr></thead>
              <tbody>
                {employees.map(emp => {
                  const cat = displayCat(emp.category || emp.role);
                  const auto = isAutoEmp(emp);
                  return (
                    <tr key={emp.id}>
                      <td style={{ fontWeight: 700, color: "#6b7280" }}>{emp.id}</td>
                      <td style={{ color: "#1a1f2e", fontWeight: 500 }}>{emp.name}</td>
                      <td><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: roleColor[cat] || "#1a1f2e" }}>{cat}</span></td>
                      <td><span style={{ fontSize: 11, fontWeight: 700, padding: "2px 7px", borderRadius: 3, background: auto ? "#eaf5ea" : "#fff8e6", color: auto ? "#2a8a2a" : "#b8860b", border: `1px solid ${auto ? "#c0e0c0" : "#f0dfa0"}` }}>{auto ? "Auto" : "Required"}</span></td>
                      {showPasswords && <td style={{ fontFamily: "monospace", fontSize: 13, color: "#374151" }}>{emp.password}</td>}
                      <td><span style={{ fontSize: 12, color: emp.must_change_password ? "#cc4444" : "#2a8a2a" }}>{emp.must_change_password ? "Yes" : "No"}</span></td>
                      <td>
                        <div style={{ display: "flex", gap: 6 }}>
                          <button className="btn btn-sm btn-secondary" style={{ minHeight: 36 }} onClick={() => {
                            setForm({ id: emp.id, name: emp.name, role: emp.role, password: emp.password || "", supervisor: emp.supervisor || "", work_email: emp.work_email || "", autoApprove: (emp.category || "").endsWith("_auto") });
                            setEditing(emp.id);
                          }}>Edit</button>
                          <button className="btn btn-sm btn-danger" style={{ minHeight: 36 }} onClick={() => removeEmp(emp.id)}>Del</button>
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

      {/* ── Entry management ── */}
      <div className="card">
        <div style={{ marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid #e4e7f0" }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#1a1f2e", marginBottom: 2 }}>Entry Management</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>Permanently delete any entry — useful for removing test data.</div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 12, alignItems: "center" }}>
          {["all", "pending", "approved", "rejected"].map(f => (
            <button key={f} className={`btn btn-sm ${entryFilter === f ? "btn-primary" : "btn-secondary"}`} onClick={() => setEntryFilter(f)}>
              {f.charAt(0).toUpperCase() + f.slice(1)}
              {f !== "all" && <span style={{ marginLeft: 4, opacity: 0.7 }}>({entries.filter(e => e.status === f).length})</span>}
            </button>
          ))}
          <input className="form-input" placeholder="Search employee or project…" value={entrySearch} onChange={e => setEntrySearch(e.target.value)} style={{ fontSize: 14, maxWidth: 240, padding: "7px 10px" }} />
        </div>
        {entriesLoading ? <Spinner /> : visibleEntries.length === 0
          ? <div style={{ color: "#6b7280", fontStyle: "italic", fontSize: 14 }}>No entries match.</div>
          : (
            <div className="table-wrap">
              <table>
                <thead><tr><th>Employee</th><th>Date</th><th>Project</th><th>Hrs</th><th>Type</th><th>Status</th><th></th></tr></thead>
                <tbody>
                  {visibleEntries.map(e => (
                    <tr key={e.id}>
                      <td style={{ color: "#1a1f2e", fontWeight: 500 }}>{e.employee_name}</td>
                      <td style={{ color: "#6b7280" }}>{e.date}</td>
                      <td style={{ fontWeight: 700 }}>{e.job}</td>
                      <td>{e.hours}</td>
                      <td>{e.rnd ? <span className="rnd-badge">R&D</span> : <span style={{ color: "#6b7280", fontSize: 12 }}>Reg</span>}</td>
                      <td><span className={`pill pill-${e.status}`}>{e.status}</span></td>
                      <td><button className="btn btn-sm btn-danger" style={{ minHeight: 36 }} onClick={() => setDeleteTarget(e)}>Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )
        }
        {!entriesLoading && <div style={{ marginTop: 10, fontSize: 12, color: "#9ca3af" }}>Showing {visibleEntries.length} of {entries.length} entries</div>}
      </div>

      {/* ── Work Types ── */}
      <div className="card">
        <div style={{ marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid #e4e7f0" }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#1a1f2e", marginBottom: 2 }}>Work Types</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>Configure the dropdown options shown to each role in the Log Time screen.</div>
        </div>

        <>
            {wtError && <div className="login-error" style={{ marginBottom: 12 }}>{wtError}</div>}
            <div className="form-row" style={{ marginBottom: 10 }}>
              <div className="form-group">
                <label className="form-label">Work Type Label</label>
                <input className="form-input" placeholder="e.g. Mould Base Machining" value={wtForm.label} onChange={e => setWtForm(f => ({ ...f, label: e.target.value }))} onKeyDown={e => e.key === "Enter" && saveWT()} style={{ fontSize: 15 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Applies To</label>
                <select className="form-select" value={wtForm.roleType} onChange={e => setWtForm(f => ({ ...f, roleType: e.target.value }))} style={{ fontSize: 15 }}>
                  <option value="all">All Roles</option>
                  <option value="toolmaker">Toolmaker</option>
                  <option value="new_tooling">New Tooling</option>
                  <option value="cnc">CNC</option>
                </select>
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
              <button className="btn btn-primary" onClick={saveWT} style={{ flex: 1 }}>{wtEditing ? "Save Work Type" : "Add Work Type"}</button>
              {wtEditing && <button className="btn btn-secondary" onClick={() => { setWtEditing(null); setWtForm({ label: "", roleType: "all" }); }}>Cancel</button>}
            </div>
            {workTypes.length === 0
              ? <div style={{ color: "#6b7280", fontStyle: "italic", fontSize: 14 }}>No work types yet. Add one above.</div>
              : (
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Label</th><th>Applies To</th><th></th></tr></thead>
                    <tbody>
                      {workTypes.map(wt => (
                        <tr key={wt.id}>
                          <td style={{ fontWeight: 500, color: "#1a1f2e" }}>{wt.label}</td>
                          <td><span style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", color: roleColor[wt.role_type] || "#6b7280" }}>{wt.role_type}</span></td>
                          <td>
                            <div style={{ display: "flex", gap: 6 }}>
                              <button className="btn btn-sm btn-secondary" style={{ minHeight: 36 }} onClick={() => { setWtEditing(wt.id); setWtForm({ label: wt.label, roleType: wt.role_type }); }}>Edit</button>
                              <button className="btn btn-sm btn-danger" style={{ minHeight: 36 }} onClick={() => deleteWT(wt.id)}>Del</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )
            }
        </>
      </div>

      {/* ── AI Context & Training ── */}
      <div className="card">
        <div style={{ marginBottom: 14, paddingBottom: 8, borderBottom: "1px solid #e4e7f0" }}>
          <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 2, textTransform: "uppercase", color: "#1a1f2e", marginBottom: 2 }}>AI Context & Training</div>
          <div style={{ fontSize: 13, color: "#6b7280" }}>See exactly what the AI knows, and add custom instructions to improve its answers.</div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(3,1fr)", gap: 10, marginBottom: 16 }}>
          {[["Approved Entries", approvedEntries.length, "#1a1f2e"], ["Project Codes", projectCodes.length, "#c8a84b"], ["Total Hours", approvedEntries.reduce((s,e)=>s+Number(e.hours),0).toFixed(1)+"h", "#2a8a2a"]].map(([label, val, color]) => (
            <div key={label} style={{ background: "#f8f9fc", border: "1px solid #e4e7f0", borderRadius: 6, padding: "10px 12px" }}>
              <div style={{ fontSize: 10, letterSpacing: 1.5, textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>{label}</div>
              <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, color }}>{val}</div>
            </div>
          ))}
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="form-label" style={{ marginBottom: 6 }}>Custom AI Instructions</label>
          <div style={{ fontSize: 12, color: "#6b7280", marginBottom: 8, lineHeight: 1.5 }}>
            These instructions are prepended to every AI prompt. Use them to correct recurring mistakes, add context the AI is missing, or set the tone of answers.
          </div>
          <textarea
            className="form-input"
            rows={4}
            placeholder={`e.g.\n- Project 2161 is the main mould making contract for Ford.\n- Ignore entries before 2025-01-01 when calculating totals.\n- Always show hours rounded to 1 decimal place.`}
            value={aiNotes}
            onChange={e => setAiNotes(e.target.value)}
            style={{ fontSize: 14, resize: "vertical", fontFamily: "'Barlow',sans-serif" }}
          />
          <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
            <button className="btn btn-primary" onClick={saveAiNotes} style={{ flex: 1 }}>Save AI Instructions</button>
            {aiNotes && <button className="btn btn-secondary" onClick={clearAiNotes}>Clear</button>}
          </div>
        </div>

        <button
          className="btn btn-secondary"
          style={{ width: "100%", marginBottom: showAIContext ? 10 : 0 }}
          onClick={() => setShowAIContext(v => !v)}
        >
          {showAIContext ? "▲ Hide Full AI Context" : "▼ View Full AI Context (what the AI sees)"}
        </button>
        {showAIContext && (
          <pre style={{ background: "#1a1f2e", color: "#c8a84b", padding: "14px", borderRadius: 6, fontSize: 11, overflowX: "auto", whiteSpace: "pre-wrap", lineHeight: 1.6, maxHeight: 400, overflowY: "auto", margin: 0 }}>
            {aiContextText}
          </pre>
        )}
      </div>

      <Footer />
    </div>
  );
}
