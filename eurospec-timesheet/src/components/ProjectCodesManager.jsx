import { useState, useEffect, useRef } from "react";
import { db } from "../lib/db";
import { Footer } from "./shared/Footer";
import { HelpButton } from "./shared/HelpButton";
import { Spinner } from "./shared/Spinner";

export function ProjectCodesManager({ showToast, onHelp }) {
  const [codes, setCodes] = useState([]);
  const [code, setCode] = useState("");
  const [desc, setDesc] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [importing, setImporting] = useState(false);
  const [importPreview, setImportPreview] = useState(null);
  const fileRef = useRef(null);

  useEffect(() => { db.get("project_codes", "order=code.asc").then(d => { setCodes(d); setLoading(false); }); }, []);

  const add = async () => {
    setError("");
    if (!code.trim()) { setError("Project code is required."); return; }
    if (codes.find(p => p.code === code.trim())) { setError("Code already exists."); return; }
    await db.post("project_codes", { code: code.trim(), description: desc.trim() });
    setCodes(prev => [...prev, { code: code.trim(), description: desc.trim() }].sort((a, b) => a.code.localeCompare(b.code)));
    showToast(`Project code ${code.trim()} added.`);
    setCode(""); setDesc("");
  };

  const remove = async (c) => {
    await db.delete("project_codes", `code=eq.${c}`);
    setCodes(prev => prev.filter(p => p.code !== c));
    showToast(`Project code ${c} removed.`);
  };

  const handleFile = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target.result;
      const lines = text.trim().split(/\r?\n/);
      const parsed = [];
      lines.forEach((line, i) => {
        if (i === 0 && (line.toLowerCase().includes("code") || line.toLowerCase().includes("project"))) return;
        const parts = line.split(/,|\t/);
        const c = (parts[0] || "").replace(/"/g, "").trim();
        const d = (parts[1] || "").replace(/"/g, "").trim();
        if (c) parsed.push({ code: c, description: d });
      });
      setImportPreview(parsed);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const confirmImport = async () => {
    if (!importPreview) return;
    setImporting(true);
    let added = 0; let skipped = 0;
    for (const row of importPreview) {
      if (codes.find(p => p.code === row.code)) { skipped++; continue; }
      await db.post("project_codes", { code: row.code, description: row.description });
      added++;
    }
    const updated = await db.get("project_codes", "order=code.asc");
    setCodes(updated);
    setImportPreview(null);
    setImporting(false);
    showToast(`Imported ${added} codes${skipped ? `, skipped ${skipped} duplicates` : ""}.`);
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

      {importPreview && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.4)", zIndex: 400, display: "flex", alignItems: "center", justifyContent: "center", padding: 16 }}>
          <div style={{ background: "#fff", borderRadius: 8, width: "100%", maxWidth: 520, padding: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", maxHeight: "80vh", overflow: "auto" }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "#1a1f2e", marginBottom: 4 }}>Import Preview</div>
            <div style={{ fontSize: 14, color: "#6b7280", marginBottom: 16 }}>{importPreview.length} codes found in file</div>
            <div style={{ maxHeight: 300, overflow: "auto", marginBottom: 16, border: "1px solid #e4e7f0", borderRadius: 6 }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead><tr style={{ background: "#f8f9fc" }}><th style={{ padding: "8px 12px", textAlign: "left", fontSize: 12, color: "#6b7280", letterSpacing: 1 }}>CODE</th><th style={{ padding: "8px 12px", textAlign: "left", fontSize: 12, color: "#6b7280", letterSpacing: 1 }}>DESCRIPTION</th></tr></thead>
                <tbody>
                  {importPreview.map(p => (
                    <tr key={p.code} style={{ borderTop: "1px solid #f0f2f5" }}>
                      <td style={{ padding: "8px 12px", fontWeight: 700, color: codes.find(x => x.code === p.code) ? "#cc4444" : "#1a1f2e" }}>{p.code} {codes.find(x => x.code === p.code) && <span style={{ fontSize: 11, color: "#cc4444" }}>(exists)</span>}</td>
                      <td style={{ padding: "8px 12px", color: "#374151", fontSize: 14 }}>{p.description || "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button className="btn btn-secondary" onClick={() => setImportPreview(null)} style={{ flex: 1 }}>Cancel</button>
              <button className="btn btn-primary" onClick={confirmImport} disabled={importing} style={{ flex: 1, padding: "12px" }}>{importing ? "Importing..." : `Import ${importPreview.filter(p => !codes.find(x => x.code === p.code)).length} new codes`}</button>
            </div>
          </div>
        </div>
      )}

      <div className="card">
        <div className="card-title">Add Code</div>
        {error && <div className="login-error" style={{ marginBottom: 12 }}>{error}</div>}
        <div className="form-row">
          <div className="form-group">
            <label className="form-label">Project Code</label>
            <input className="form-input" placeholder="e.g. 2267" value={code} onChange={e => setCode(e.target.value)} style={{ fontSize: 16 }} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <input className="form-input" placeholder="e.g. Fisher D659" value={desc} onChange={e => setDesc(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} style={{ fontSize: 16 }} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="btn btn-primary" onClick={add} style={{ flex: 1, padding: "13px" }}>+ Add Single Code</button>
          <button className="btn btn-secondary" onClick={() => fileRef.current?.click()} style={{ padding: "13px 20px", whiteSpace: "nowrap" }}>↑ Import CSV</button>
          <input ref={fileRef} type="file" accept=".csv,.txt,.tsv" style={{ display: "none" }} onChange={handleFile} />
        </div>
        <div style={{ marginTop: 8, fontSize: 13, color: "#6b7280" }}>
          CSV format: two columns — Code, Description. First row can be a header. Tab or comma separated.
        </div>
      </div>

      <div className="card">
        <div className="card-title">Active Codes ({codes.length})</div>
        {loading ? <Spinner /> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Code</th><th>Description</th><th></th></tr></thead>
              <tbody>
                {codes.map(p => (
                  <tr key={p.code}>
                    <td style={{ fontWeight: 700, fontSize: 15, color: "#1a1f2e" }}>{p.code}</td>
                    <td style={{ color: "#374151" }}>{p.description || "—"}</td>
                    <td><button className="btn btn-sm btn-danger" onClick={() => remove(p.code)} style={{ minHeight: 36 }}>Remove</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
}
