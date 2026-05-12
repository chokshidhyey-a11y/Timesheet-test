import { useState, useEffect, useRef } from "react";
import { db } from "../lib/db";
import { GROQ_KEY } from "../lib/ai";

const AI_ROLES = ["supervisor", "finance", "admin"];

export function AIAssistant({ user }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "assistant", content: "Hi! Ask me anything about your timesheet data — hours by project, R&D breakdowns, top employees, or anything else." }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [entries, setEntries] = useState([]);
  const [projectCodes, setProjectCodes] = useState([]);
  const [dataLoaded, setDataLoaded] = useState(false);
  const bottomRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (!AI_ROLES.includes(user?.role)) return;
    Promise.all([
      db.get("entries", "status=eq.approved&order=date.asc"),
      db.get("project_codes", "order=code.asc")
    ]).then(([ents, pcs]) => {
      setEntries(ents || []); setProjectCodes(pcs || []); setDataLoaded(true);
    });
  }, [user?.role]);

  useEffect(() => {
    if (open) {
      setTimeout(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        inputRef.current?.focus();
      }, 150);
    }
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  if (!AI_ROLES.includes(user?.role)) return null;

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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${GROQ_KEY}` },
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

  const suggestions = ["Who worked the most hours?", "R&D vs regular hours split?", "Which project has the most hours?", "Give me a summary"];

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          title="Open AI Assistant"
          style={{
            position: "fixed", bottom: 20, right: 20, zIndex: 500,
            background: "#1a1f2e", color: "#fff", border: "none", borderRadius: 28,
            padding: "11px 20px", cursor: "pointer", display: "flex", alignItems: "center", gap: 8,
            fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: 1,
            boxShadow: "0 4px 20px rgba(0,0,0,0.22)", transition: "transform .15s, box-shadow .15s",
          }}
          onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 6px 24px rgba(0,0,0,0.28)"; }}
          onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 20px rgba(0,0,0,0.22)"; }}
        >
          <span style={{ fontSize: 17, color: "#c8a84b", lineHeight: 1 }}>✦</span>
          <span>AI</span>
        </button>
      )}

      {open && (
        <div style={{
          position: "fixed", bottom: 20, right: 20, zIndex: 500,
          width: 370, maxWidth: "calc(100vw - 24px)",
          background: "#fff", borderRadius: 12, border: "1px solid #d8dce8",
          boxShadow: "0 8px 36px rgba(0,0,0,0.18)", display: "flex", flexDirection: "column",
          overflow: "hidden",
        }}>
          {/* Header */}
          <div style={{
            background: "#1a1f2e", padding: "12px 14px",
            display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span style={{ fontSize: 17, color: "#c8a84b", lineHeight: 1 }}>✦</span>
              <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 14, fontWeight: 700, letterSpacing: 1.5, textTransform: "uppercase", color: "#fff" }}>AI Assistant</span>
              {!dataLoaded && <span style={{ fontSize: 11, color: "#6b7280" }}>· loading…</span>}
            </div>
            <button
              onClick={() => setOpen(false)}
              title="Minimise"
              style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer", fontSize: 22, lineHeight: 1, padding: "0 4px", display: "flex", alignItems: "center" }}
            >−</button>
          </div>

          {/* Messages */}
          <div style={{
            overflowY: "auto", padding: "14px 14px 8px",
            display: "flex", flexDirection: "column", gap: 12,
            maxHeight: 360, minHeight: 160,
          }}>
            {messages.map((m, i) => (
              <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start", flexDirection: m.role === "user" ? "row-reverse" : "row" }}>
                <div style={{
                  width: 26, height: 26, borderRadius: "50%", flexShrink: 0,
                  background: m.role === "user" ? "#1a1f2e" : "#c8a84b",
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 10, fontWeight: 700, color: "#fff",
                }}>
                  {m.role === "user" ? "U" : "✦"}
                </div>
                <div style={{
                  maxWidth: "82%", padding: "8px 11px",
                  borderRadius: m.role === "user" ? "12px 4px 12px 12px" : "4px 12px 12px 12px",
                  background: m.role === "user" ? "#1a1f2e" : "#f8f9fc",
                  color: m.role === "user" ? "#fff" : "#1a1f2e",
                  fontSize: 13, lineHeight: 1.6,
                  border: m.role === "user" ? "none" : "1px solid #e4e7f0",
                  whiteSpace: "pre-wrap",
                }}>
                  {m.content}
                </div>
              </div>
            ))}
            {loading && (
              <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                <div style={{ width: 26, height: 26, borderRadius: "50%", background: "#c8a84b", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "#fff" }}>✦</div>
                <div style={{ padding: "10px 14px", borderRadius: "4px 12px 12px 12px", background: "#f8f9fc", border: "1px solid #e4e7f0", display: "flex", gap: 5, alignItems: "center" }}>
                  <style>{`@keyframes aibounce{0%,80%,100%{transform:scale(0)}40%{transform:scale(1)}}`}</style>
                  {[0, 1, 2].map(i => <div key={i} style={{ width: 6, height: 6, borderRadius: "50%", background: "#c8a84b", animation: `aibounce 1s ease-in-out ${i * 0.2}s infinite` }} />)}
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Suggestions */}
          {messages.length <= 1 && (
            <div style={{ padding: "0 14px 10px", display: "flex", gap: 6, flexWrap: "wrap" }}>
              {suggestions.map(s => (
                <button key={s} onClick={() => setInput(s)} style={{
                  background: "#f0f2f5", border: "1px solid #e4e7f0", color: "#374151",
                  padding: "5px 10px", borderRadius: 20, fontSize: 12, cursor: "pointer",
                }}>
                  {s}
                </button>
              ))}
            </div>
          )}

          {/* Input row */}
          <div style={{ borderTop: "1px solid #e4e7f0", padding: "10px 12px", display: "flex", gap: 8, alignItems: "center", background: "#fff", flexShrink: 0 }}>
            <input
              ref={inputRef}
              className="form-input"
              placeholder={dataLoaded ? "Ask anything…" : "Loading data…"}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === "Enter" && send()}
              disabled={loading || !dataLoaded}
              style={{ fontSize: 13, flex: 1, padding: "9px 10px" }}
            />
            <button
              onClick={send}
              disabled={loading || !input.trim() || !dataLoaded}
              style={{
                background: "#1a1f2e", color: "#fff", border: "none", borderRadius: 6,
                padding: "9px 14px", cursor: "pointer",
                fontFamily: "'Barlow Condensed',sans-serif", fontSize: 13, fontWeight: 700,
                letterSpacing: 1, textTransform: "uppercase",
                opacity: (loading || !input.trim() || !dataLoaded) ? 0.45 : 1,
                whiteSpace: "nowrap",
              }}
            >↑</button>
          </div>
        </div>
      )}
    </>
  );
}
