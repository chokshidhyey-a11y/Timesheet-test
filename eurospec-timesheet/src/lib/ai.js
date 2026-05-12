export const GROQ_KEY = "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";

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
