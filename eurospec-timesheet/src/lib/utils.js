export const uid = () => Math.random().toString(36).slice(2, 9);
export const today = () => new Date().toISOString().split("T")[0];
export const dayOfDate = (d) => {
  const day = new Date(d + "T12:00:00").getDay();
  return ["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"][day];
};
export const computeSeq = (entries) => {
  const totals = {};
  entries.forEach(e => { const k = `${e.employee_id}|${e.date}|${e.job}`; totals[k] = (totals[k] || 0) + 1; });
  const counts = {};
  return entries.map(e => {
    const k = `${e.employee_id}|${e.date}|${e.job}`;
    counts[k] = (counts[k] || 0) + 1;
    return { ...e, dateSeq: totals[k] > 1 ? counts[k] : "" };
  });
};
export const getWeekRange = (offset = 0) => {
  const now = new Date();
  const diff = (now.getDay() === 0 ? -6 : 1 - now.getDay()) + offset * 7;
  const mon = new Date(now); mon.setDate(now.getDate() + diff);
  const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
  return { from: mon.toISOString().split("T")[0], to: sun.toISOString().split("T")[0] };
};
export const getMonthRange = (offset = 0) => {
  const now = new Date();
  const first = new Date(now.getFullYear(), now.getMonth() + offset, 1);
  const last = new Date(now.getFullYear(), now.getMonth() + offset + 1, 0);
  return { from: first.toISOString().split("T")[0], to: last.toISOString().split("T")[0] };
};

export const SESSION_KEY = "es_user";
export const saveSession = (u) => sessionStorage.setItem(SESSION_KEY, JSON.stringify(u));
export const loadSession = () => { try { const v = sessionStorage.getItem(SESSION_KEY); return v ? JSON.parse(v) : null; } catch { return null; } };
export const clearSession = () => sessionStorage.removeItem(SESSION_KEY);
