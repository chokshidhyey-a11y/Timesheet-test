export const GROQ_KEY = "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";

export const buildAIContext = (entries, projectCodes, customNotes = "") => {
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
  const base = `You are an AI assistant for EuroClock, a timesheet app at Eurospec Tooling & Manufacturing. Today: ${now.toDateString()}.

TOTALS: ${entries.length} entries, ${totalHrs.toFixed(1)} total hrs, ${rndHrs.toFixed(1)} R&D hrs, ${(totalHrs - rndHrs).toFixed(1)} LB hrs.

HOURS BY PROJECT:
${Object.entries(byProject).sort((a,b)=>b[1].total-a[1].total).slice(0,15).map(([job,d])=>`  ${job}: ${d.total.toFixed(1)} hrs (LB:${d.lb.toFixed(1)} RD:${d.rnd.toFixed(1)}, ${d.count} entries)`).join("\n")}

HOURS BY EMPLOYEE:
${Object.entries(byEmployee).sort((a,b)=>b[1].total-a[1].total).map(([name,d])=>`  ${name}: ${d.total.toFixed(1)} hrs (LB:${d.lb.toFixed(1)} RD:${d.rnd.toFixed(1)})`).join("\n")}

HOURS BY MONTH:
${Object.entries(byMonth).sort((a,b)=>a[0].localeCompare(b[0])).map(([m,d])=>`  ${m}: ${d.total.toFixed(1)} hrs`).join("\n")}

PROJECT CODES: ${projectCodes.map(p=>`${p.code}(${p.description||"no desc"})`).join(", ")}

Answer concisely and naturally. Format numbers clearly. If data is not available, say so.`;
  return customNotes ? `CUSTOM INSTRUCTIONS FROM ADMIN:\n${customNotes}\n\n---\n\n${base}` : base;
};

export const suggestProjectCode = async (comment, projectCodes) => {
  if (!comment || comment.length < 4 || projectCodes.length === 0) return null;
  try {
    const codeList = projectCodes.map(p => `${p.code}${p.description ? ` (${p.description})` : ""}`).join(", ");
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${GROQ_KEY}` },
      body: JSON.stringify({
        model: "llama-3.3-70b-versatile",
        max_tokens: 50,
        messages: [
          { role: "system", content: `You are a helper for a manufacturing timesheet app. Given a work description and a list of project codes, return ONLY the single best matching project code number. If no good match exists, return "none". Never explain, just return the code or "none".` },
          { role: "user", content: `Work description: "${comment}"\n\nAvailable project codes: ${codeList}\n\nBest matching code:` }
        ]
      })
    });
    const data = await res.json();
    const suggested = data.choices?.[0]?.message?.content?.trim();
    if (!suggested || suggested === "none") return null;
    const match = projectCodes.find(p => p.code === suggested || suggested.includes(p.code));
    return match ? match.code : null;
  } catch { return null; }
};
