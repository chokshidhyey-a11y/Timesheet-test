import { useState, useEffect, useRef } from "react";
import { db } from "../lib/db";
import { GROQ_KEY } from "../lib/ai";
import { Footer } from "./shared/Footer";
import { HelpButton } from "./shared/HelpButton";

export function AIAssistant({ onHelp }) {
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! I'm the EuroClock AI Assistant. Ask me anything about your timesheet data — hours by project, who worked the most, R&D breakdowns, or anything else." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [projectCodes, setProjectCodes] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    Promise.all([
      db.get("entries", "status=eq.approved&order=date.asc"),
      db.get("employees", "order=name.asc"),
      db.get("project_codes", "order=code.asc")
    ]).then(([ents, emps, pcs]) => {
      setEntries(ents); setEmployees(emps); setProjectCodes(pcs); setDataLoaded(true);
    });
  }, []);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages]);

  const buildContext = () => {
    const now = new Date();
    const byProject = {}; const byEmployee = {}; const byMonth = {};
    entries.forEach(e => {
      const hrs = Number(e.hours);
      byProject[e.job] = byProject[e.job] || { total: 0, rnd: 0, lb: 0, count: 0 };
      byProject[e.job].total += hrs; byProject[e.job].count++;
      if (e.rnd) byProject[e.job].rnd += hrs; else byProject[e.job].lb += hrs;
      byEmployee[e.employee_name] = byEmployee[e.employee_name] || { total: 0, rnd: 0, lb: 0 };
      byEmployee[e.employee_name].total += hrs;
      if (e.rnd) byEmployee[e.employee_name].rnd += hrs; else byEmployee[e.employee_name].lb += hrs;
      const month = e.date.slice(0, 7);
      byMonth[month] = byMonth[month] || { total: 0, rnd: 0, lb: 0 };
      byMonth[month].total += hrs;
      if (e.rnd) byMonth[month].rnd += hrs; else byMonth[month].lb += hrs;
    });
    const totalHrs = entries.reduce((s, e) => s + Number(e.hours), 0);
    const rndHrs = entries.filter(e => e.rnd).reduce((s, e) => s + Number(e.hours), 0);
    return `You are an AI assistant for EuroClock, a timesheet app at Eurospec Tooling & Manufacturing. Today: ${now.toDateString()}.

TOTALS: ${entries.length} entries, ${totalHrs.toFixed(1)} total hrs, ${rndHrs.toFixed(1)} R&D hrs, ${(totalHrs - rndHrs).toFixed(1)} LB hrs.

HOURS BY PROJECT:
${Object.entries(byProject).sort((a, b) => b[1].total - a[1].total).slice(0, 15).map(([job, d]) => `  ${job}: ${d.total.toFixed(1)} hrs (LB:${d.lb.toFixed(1)} RD:${d.rnd.toFixed(1)}, ${d.count} entries)`).join("\n")}

HOURS BY EMPLOYEE:
${Object.entries(byEmployee).sort((a, b) => b[1].total - a[1].total).map(([name, d]) => `  ${name}: ${d.total.toFixed(1)} hrs (LB:${d.lb.toFixed(1)} RD:${d.rnd.toFixed(1)})`).join("\n")}

HOURS BY MONTH:
${Object.entries(byMonth).sort((a, b) => a[0].localeCompare(b[0])).map(([m, d]) => `  ${m}: ${d.total.toFixed(1)} hrs`).join("\n")}

PROJECT CODES: ${projectCodes.map(p => `${p.code}(${p.description || "no desc"})`).join(", ")}

Answer concisely and naturally. Format numbers clearly. If data is not available, say so.`;
  };

  const send = async () => {
    const q = input.trim();
    if (!q || loading) return;
    setInput("");
    const newMessages = [...messages, { role: "user", content: q }];
    setMessages(newMessages);
    setLoading(true);
    try {
      const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
        body: JSON.stringify({
          model: "llama-3.3-70b-versatile",
          max_tokens: 500,
          messages: [
            { role: "system", content: buildContext() },
            ...newMessages.map(m => ({ role: m.role, content: m.content }))
          ]
        })
      });
      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "Sorry, I could not get a response.";
      setMessages(prev => [...prev, { role: "assistant", content: reply }]);
    } catch {
      setMessages(prev => [...prev, { role: "assistant", content: "Connection error. Please try again." }]);
    }
    setLoading(false);
    setTimeout(() => inputRef.current?.focus(), 100);
  };

  const suggestions = ["Who worked the most hours this month?", "What is the R&D vs regular hours split?", "Which project has the most hours?", "Give me a summary of all projects"];

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">AI Assistant</div>
          <div className="page-sub">Ask anything about your timesheet data in plain English</div>
        </div>
        <HelpButton onClick={onHelp} />
      </div>
      <div className="card" style={{ padding: 0, overflow: "hidden" }}>
        <div style={{ height: 420, overflowY: "auto", padding: "20px 20px 12px", display: "flex", flexDirection: "column", gap: 14 }}>
          {messages.map((m, i) => (
            <div key={i} style={{ display: "flex", gap: 10, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", flexShrink: 0, background: m.role === "user" ? "#1a1f2e" : "#c8a84b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>
                {m.role === "user" ? "U" : "✦"}
              </div>
              <div style={{ maxWidth: "75%", padding: "10px 14px", borderRadius: m.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px", background: m.role === "user" ? "#1a1f2e" : "#f8f9fc", color: m.role === "user" ? "#fff" : "#1a1f2e", fontSize: 14, lineHeight: 1.6, border: m.role === "user" ? "none" : "1px solid #e4e7f0", whiteSpace: "pre-wrap" }}>
                {m.content}
              </div>
            </div>
          ))}
          {loading && (
            <div style={{ display: "flex", gap: 10, alignItems: "flex-start" }}>
              <div style={{ width: 32, height: 32, borderRadius: "50%", background: "#c8a84b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 13, fontWeight: 700, color: "#fff" }}>✦</div>
              <div style={{ padding: "12px 16px", borderRadius: "4px 12px 12px 12px", background: "#f8f9fc", border: "1px solid #e4e7f0", display: "flex", gap: 5, alignItems: "center" }}>
                <style>{`@keyframes bounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
                {[0, 1, 2].map(i => <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: "#c8a84b", animation: `bounce 1s ease-in-out ${i * 0.2}s infinite` }} />)}
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
        {messages.length <= 1 && (
          <div style={{ padding: "0 20px 14px", display: "flex", gap: 8, flexWrap: "wrap" }}>
            {suggestions.map(s => (
              <button key={s} onClick={() => setInput(s)}
                style={{ background: "#f0f2f5", border: "1px solid #e4e7f0", color: "#374151", padding: "6px 12px", borderRadius: 20, fontSize: 13, cursor: "pointer" }}>
                {s}
              </button>
            ))}
          </div>
        )}
        <div style={{ borderTop: "1px solid #e4e7f0", padding: "12px 16px", display: "flex", gap: 10, alignItems: "center", background: "#fff" }}>
          <input ref={inputRef} className="form-input" placeholder={dataLoaded ? "Ask anything about your data..." : "Loading data..."} value={input} onChange={e => setInput(e.target.value)} onKeyDown={e => e.key === "Enter" && send()} disabled={loading || !dataLoaded} style={{ fontSize: 14, flex: 1 }} />
          <button onClick={send} disabled={loading || !input.trim() || !dataLoaded} style={{ background: "#1a1f2e", color: "#fff", border: "none", borderRadius: 6, padding: "11px 18px", cursor: "pointer", fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700, letterSpacing: 1, textTransform: "uppercase", opacity: (loading || !input.trim()) ? 0.5 : 1, whiteSpace: "nowrap" }}>
            Send ↑
          </button>
        </div>
      </div>
      <div style={{ textAlign: "center", fontSize: 12, color: "#6b7280", marginTop: 8 }}>
        {dataLoaded ? `Loaded ${entries.length} approved entries · ${projectCodes.length} projects · ${employees.length} employees` : "Loading data..."}
      </div>
      <Footer />
    </div>
  );
}
