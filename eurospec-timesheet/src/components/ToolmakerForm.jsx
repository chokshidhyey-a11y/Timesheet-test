import { useState, useEffect, useRef } from "react";
import { db } from "../lib/db";
import { uid, today, dayOfDate } from "../lib/utils";
import { suggestProjectCode } from "../lib/ai";
import { ProjectInput } from "./shared/ProjectInput";
import { Footer } from "./shared/Footer";
import { HelpButton } from "./shared/HelpButton";

export function ToolmakerForm({ user, showToast, onHelp }) {
  const [date, setDate] = useState(today());
  const [jobs, setJobs] = useState([{ id: uid(), job: "", hours: "", rnd: false, comment: "" }]);
  const [projectCodes, setPCs] = useState([]);
  const [myEntries, setMine] = useState([]);
  const [saving, setSaving] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState({});
  const [editMyEntry, setEditMyEntry] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const aiTimers = useRef({});
  const jobsRef = useRef(jobs);
  const isCNC = (user.category || user.role) === "cnc";

  useEffect(() => { jobsRef.current = jobs; }, [jobs]);

  useEffect(() => {
    db.get("project_codes", "order=code.asc").then(setPCs);
    db.get("entries", `employee_id=eq.${user.id}&order=created_at.desc&limit=30`).then(setMine);
  }, [user.id]);

  const addRow = () => setJobs(j => [...j, { id: uid(), job: "", hours: "", rnd: false, comment: "" }]);
  const removeRow = (id) => {
    setJobs(j => j.filter(r => r.id !== id));
    setAiSuggestions(s => { const n = { ...s }; delete n[id]; return n; });
  };

  const updateRow = (id, field, val) => {
    setJobs(j => j.map(r => r.id === id ? { ...r, [field]: val } : r));
    if (field === "comment" && val.length >= 5) {
      clearTimeout(aiTimers.current[id]);
      setAiSuggestions(s => ({ ...s, [id]: { ...s[id], loading: true } }));
      aiTimers.current[id] = setTimeout(async () => {
        const row = jobsRef.current.find(r => r.id === id);
        if (row && !row.job) {
          const code = await suggestProjectCode(val, projectCodes);
          setAiSuggestions(s => ({ ...s, [id]: { code, loading: false } }));
        } else {
          setAiSuggestions(s => ({ ...s, [id]: { code: null, loading: false } }));
        }
      }, 800);
    } else if (field === "comment" && val.length < 5) {
      setAiSuggestions(s => ({ ...s, [id]: { code: null, loading: false } }));
    }
    if (field === "job") {
      setAiSuggestions(s => ({ ...s, [id]: { code: null, loading: false } }));
    }
  };

  const acceptSuggestion = (rowId, code) => {
    setJobs(j => j.map(r => r.id === rowId ? { ...r, job: code } : r));
    setAiSuggestions(s => ({ ...s, [rowId]: { code: null, loading: false } }));
  };

  const totalHrs = jobs.reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const rndHrs = jobs.filter(r => r.rnd).reduce((s, r) => s + (parseFloat(r.hours) || 0), 0);
  const regHrs = totalHrs - rndHrs;

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
      const updated = await db.get("entries", `employee_id=eq.${user.id}&order=created_at.desc&limit=30`);
      setMine(updated);
    } catch { showToast("Failed to submit. Please try again.", "error"); }
    finally { setSaving(false); }
  };

  const saveMyEdit = async () => {
    if (!editMyEntry) return;
    await db.patch("entries", `id=eq.${editMyEntry.id}`, { hours: parseFloat(editMyEntry.hours), job: editMyEntry.job, notes: editMyEntry.notes });
    setMine(prev => prev.map(e => e.id === editMyEntry.id ? { ...e, hours: parseFloat(editMyEntry.hours), job: editMyEntry.job, notes: editMyEntry.notes } : e));
    showToast("Entry updated.");
    setEditMyEntry(null);
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    await db.delete("entries", `id=eq.${deleteTarget}`);
    setMine(prev => prev.filter(e => e.id !== deleteTarget));
    showToast("Entry deleted.");
    setDeleteTarget(null);
  };

  const hasPending = myEntries.some(e => e.status === "pending");

  return (
    <div className="page">
      {editMyEntry && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 8, width: "100%", maxWidth: 480, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1f2e", marginBottom: 4 }}>Edit Entry</div>
            <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>Changes will remain pending for supervisor review.</div>
            <div className="form-group" style={{ marginBottom: 12 }}>
              <label className="form-label">Project Code</label>
              <ProjectInput value={editMyEntry.job} onChange={val => setEditMyEntry(p => ({ ...p, job: val }))} projectCodes={projectCodes} />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label className="form-label">Hours</label>
                <input className="form-input" type="number" min="0.25" max="24" step="0.25" value={editMyEntry.hours} onChange={e => setEditMyEntry(p => ({ ...p, hours: e.target.value }))} style={{ fontSize: 16 }} />
              </div>
              <div className="form-group">
                <label className="form-label">Date</label>
                <input className="form-input" value={editMyEntry.date} disabled style={{ background: "#f8f9fc", color: "#9aa0b4" }} />
              </div>
            </div>
            <div className="form-group" style={{ marginBottom: 16 }}>
              <label className="form-label">Comment</label>
              <input className="form-input" value={editMyEntry.notes || ""} onChange={e => setEditMyEntry(p => ({ ...p, notes: e.target.value }))} placeholder="Describe work..." style={{ fontSize: 14 }} />
            </div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setEditMyEntry(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={saveMyEdit}>Save Changes</button>
            </div>
          </div>
        </div>
      )}

      {deleteTarget && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 8, width: "100%", maxWidth: 360, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.15)" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1f2e", marginBottom: 8 }}>Delete Entry?</div>
            <div style={{ fontSize: 14, color: "#4b5563", marginBottom: 20, lineHeight: 1.5 }}>This entry will be permanently removed and cannot be recovered.</div>
            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setDeleteTarget(null)}>Cancel</button>
              <button className="btn btn-danger" style={{ background: "#fff0f0" }} onClick={confirmDelete}>Delete</button>
            </div>
          </div>
        </div>
      )}

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
            <input className="form-input" type="date" value={date} onChange={e => setDate(e.target.value)} style={{ fontSize: 16 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Day</label>
            <div style={{ padding: "11px 12px", background: "#f8f9fc", border: "1px solid #e4e7f0", borderRadius: 6, color: "#c8a84b", fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, letterSpacing: 1, fontSize: 15 }}>{date ? dayOfDate(date) : "—"}</div>
          </div>
        </div>
        <div className="card-title" style={{ marginTop: 8 }}>Jobs & Hours</div>
        <div className="job-rows">
          {jobs.map(row => (
            <div key={row.id} style={{ background: row.rnd ? "#f0faf0" : "#f8f9fc", border: `1px solid ${row.rnd ? "#c0e0c0" : "#e4e7f0"}`, borderRadius: 6, padding: 12, transition: "background .2s" }}>
              <div className="job-row-grid">
                <ProjectInput value={row.job} onChange={val => updateRow(row.id, "job", val)} projectCodes={projectCodes} />
                <input className="form-input" type="number" min="0.25" max="24" step="0.25" placeholder="Hrs" value={row.hours} onChange={e => updateRow(row.id, "hours", e.target.value)} style={{ fontSize: 16 }} />
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 7, cursor: "pointer", userSelect: "none", flex: 1 }}>
                    <input type="checkbox" checked={row.rnd} onChange={e => updateRow(row.id, "rnd", e.target.checked)} style={{ accentColor: "#2a8a2a", width: 18, height: 18 }} />
                    <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1.5, padding: "3px 10px", borderRadius: 3, whiteSpace: "nowrap", background: row.rnd ? "#eaf5ea" : "#f0f2f5", color: row.rnd ? "#2a8a2a" : "#9aa0b4", border: `1px solid ${row.rnd ? "#c0e0c0" : "#e4e7f0"}` }}>R&D</span>
                  </label>
                  {jobs.length > 1 && <button className="btn-icon" style={{ fontSize: 18, color: "#cc4444" }} onClick={() => removeRow(row.id)}>✕</button>}
                </div>
              </div>
              <input className="form-input" placeholder="Describe work (e.g. mould base machining)..." value={row.comment} onChange={e => updateRow(row.id, "comment", e.target.value)} style={{ marginTop: 8, fontSize: 14, color: "#4b5563", background: "transparent", borderColor: "#e4e7f0" }} />
              {aiSuggestions[row.id]?.loading && !row.job && (
                <div style={{ marginTop: 6, fontSize: 13, color: "#6b7280", display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ display: "inline-block", animation: "spin 0.8s linear infinite" }}>⟳</span> AI is finding the best project code...
                </div>
              )}
              {aiSuggestions[row.id]?.code && !row.job && (
                <div style={{ marginTop: 6, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                  <span style={{ fontSize: 13, color: "#4b5563" }}>✨ AI suggests:</span>
                  <button
                    onMouseDown={() => acceptSuggestion(row.id, aiSuggestions[row.id].code)}
                    style={{ background: "#1a1f2e", color: "#c8a84b", border: "none", borderRadius: 4, padding: "4px 12px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Barlow Condensed',sans-serif", letterSpacing: 1 }}>
                    {aiSuggestions[row.id].code}
                  </button>
                  <span style={{ fontSize: 12, color: "#6b7280" }}>
                    {projectCodes.find(p => p.code === aiSuggestions[row.id].code)?.description || ""}
                  </span>
                  <button onMouseDown={() => setAiSuggestions(s => ({ ...s, [row.id]: { code: null } }))}
                    style={{ background: "transparent", border: "none", color: "#9aa0b4", cursor: "pointer", fontSize: 12 }}>✕ dismiss</button>
                </div>
              )}
            </div>
          ))}
        </div>
        <button className="btn-add" onClick={addRow}>+ Add Another Job</button>
        <div style={{ marginTop: 16, background: "#f8f9fc", border: "1px solid #e4e7f0", borderRadius: 6, overflow: "hidden" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr" }}>
            {[["Regular", regHrs, "#c8a84b"], ["R&D", rndHrs, "#2a8a2a"], ["Total", totalHrs, "#1a1f2e"]].map(([label, val, color]) => (
              <div key={label} style={{ padding: "10px 12px", borderRight: label !== "Total" ? "1px solid #e4e7f0" : "none" }}>
                <div style={{ fontSize: 10, letterSpacing: 1, textTransform: "uppercase", color: "#6b7280", marginBottom: 4 }}>{label} Hrs</div>
                <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, color }}>{val.toFixed(2)}</div>
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
          <button className="btn btn-primary" onClick={submit} disabled={saving} style={{ padding: "12px 24px", fontSize: 15, width: "100%" }}>{saving ? "Submitting..." : "Submit Entry →"}</button>
        </div>
      </div>

      <div className="card">
        <div className="card-title">My Recent Entries</div>
        {myEntries.length === 0
          ? <div style={{ color: "#6b7280", fontStyle: "italic", fontSize: 14 }}>No entries yet.</div>
          : <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Project</th>
                    <th>Hrs</th>
                    <th>Type</th>
                    <th>Status</th>
                    {hasPending && <th></th>}
                  </tr>
                </thead>
                <tbody>
                  {myEntries.map(e => (
                    <tr key={e.id}>
                      <td>{e.date}</td>
                      <td style={{ fontWeight: 700, color: "#1a1f2e" }}>{e.job}</td>
                      <td>{e.hours}</td>
                      <td>{e.rnd ? <span className="rnd-badge">R&D</span> : <span style={{ color: "#6b7280", fontSize: 12 }}>Reg</span>}</td>
                      <td><span className={`pill pill-${e.status}`}>{e.status}</span></td>
                      {hasPending && (
                        <td>
                          {e.status === "pending" && (
                            <div style={{ display: "flex", gap: 4 }}>
                              <button className="btn btn-sm btn-secondary" style={{ minHeight: 36 }} onClick={() => setEditMyEntry({ ...e })}>Edit</button>
                              <button className="btn btn-sm btn-danger" style={{ minHeight: 36 }} onClick={() => setDeleteTarget(e.id)}>Del</button>
                            </div>
                          )}
                        </td>
                      )}
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
