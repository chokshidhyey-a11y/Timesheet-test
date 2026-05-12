import { useState, useEffect } from "react";
import { db } from "../lib/db";
import { getWeekRange, getMonthRange } from "../lib/utils";
import { Footer } from "./shared/Footer";
import { HelpButton } from "./shared/HelpButton";
import { Spinner } from "./shared/Spinner";

export function HoursDashboard({ onHelp }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState("month");

  useEffect(() => {
    db.get("entries", "status=eq.approved&order=date.asc").then(d => { setEntries(d); setLoading(false); });
  }, []);

  const range = period === "month" ? getMonthRange(0) : period === "lastmonth" ? getMonthRange(-1) : getWeekRange(0);
  const filtered = entries.filter(e => e.date >= range.from && e.date <= range.to);
  const totalHrs = filtered.reduce((s, e) => s + Number(e.hours), 0);
  const rndHrs = filtered.filter(e => e.rnd).reduce((s, e) => s + Number(e.hours), 0);
  const regHrs = totalHrs - rndHrs;

  const byProject = {};
  filtered.forEach(e => { byProject[e.job] = (byProject[e.job] || 0) + Number(e.hours); });
  const topProjects = Object.entries(byProject).sort((a, b) => b[1] - a[1]).slice(0, 10);

  const byEmp = {};
  filtered.forEach(e => { byEmp[e.employee_name] = (byEmp[e.employee_name] || 0) + Number(e.hours); });
  const topEmps = Object.entries(byEmp).sort((a, b) => b[1] - a[1]);

  const byDay = { Monday: 0, Tuesday: 0, Wednesday: 0, Thursday: 0, Friday: 0, Saturday: 0, Sunday: 0 };
  filtered.forEach(e => { if (byDay[e.day] !== undefined) byDay[e.day] += Number(e.hours); });

  const maxProjectHrs = topProjects[0]?.[1] || 1;
  const maxEmpHrs = topEmps[0]?.[1] || 1;
  const maxDayHrs = Math.max(...Object.values(byDay)) || 1;
  const barColor = "#c8a84b";
  const rndColor = "#2a8a2a";

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div className="page-title">Overview</div>
          <div className="page-sub">Hours breakdown across projects and employees</div>
        </div>
        <HelpButton onClick={onHelp} />
      </div>

      <div className="quick-filters" style={{ marginBottom: 20 }}>
        {[["week", "This Week"], ["month", "This Month"], ["lastmonth", "Last Month"]].map(([k, label]) => (
          <button key={k} className={`btn btn-sm ${period === k ? "btn-primary" : "btn-secondary"}`} onClick={() => setPeriod(k)}>{label}</button>
        ))}
      </div>

      <div className="stats-row" style={{ marginBottom: 20 }}>
        {[["Total Hours", totalHrs.toFixed(1), "#1a1f2e", "approved"],
          ["LB Hours", regHrs.toFixed(1), "#c8a84b", "regular labour"],
          ["RD Hours", rndHrs.toFixed(1), "#2a8a2a", "research & dev"],
          ["Projects", topProjects.length, "#1a1f2e", "active"]].map(([label, val, color, sub]) => (
          <div key={label} className="stat-card">
            <div className="stat-label">{label}</div>
            <div className="stat-val" style={{ color }}>{val}</div>
            <div className="stat-sub">{sub}</div>
          </div>
        ))}
      </div>

      {loading ? <Spinner /> : filtered.length === 0 ? (
        <div className="card" style={{ textAlign: "center", padding: "48px 20px" }}>
          <div style={{ fontSize: 36, marginBottom: 12 }}>📊</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: "#374151", marginBottom: 6 }}>No approved entries for this period</div>
          <div style={{ fontSize: 14, color: "#6b7280" }}>Try selecting a different time range above.</div>
        </div>
      ) : (
        <>
          <div className="card">
            <div className="card-title">Hours by Project Code</div>
            {topProjects.map(([job, hrs]) => {
              const rndForJob = filtered.filter(e => e.job === job && e.rnd).reduce((s, e) => s + Number(e.hours), 0);
              const regForJob = hrs - rndForJob;
              return (
                <div key={job} style={{ marginBottom: 14 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontFamily: "'Barlow Condensed',sans-serif", fontWeight: 700, color: "#1a1f2e", fontSize: 14 }}>{job}</span>
                    <span style={{ fontSize: 14, color: "#4b5563" }}>{hrs.toFixed(1)} hrs</span>
                  </div>
                  <div style={{ height: 10, background: "#f0f2f5", borderRadius: 5, overflow: "hidden", display: "flex" }}>
                    <div style={{ width: `${(regForJob / maxProjectHrs * 100).toFixed(0)}%`, background: barColor, transition: "width .4s" }} />
                    <div style={{ width: `${(rndForJob / maxProjectHrs * 100).toFixed(0)}%`, background: rndColor, transition: "width .4s" }} />
                  </div>
                  {rndForJob > 0 && (
                    <div style={{ fontSize: 12, color: "#6b7280", marginTop: 2 }}>
                      <span style={{ color: barColor }}>{regForJob.toFixed(1)} LB</span> · <span style={{ color: rndColor }}>{rndForJob.toFixed(1)} RD</span>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{ display: "flex", gap: 16, marginTop: 8, fontSize: 13 }}>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, background: barColor, borderRadius: 2, display: "inline-block" }} /> Regular (LB)</span>
              <span style={{ display: "flex", alignItems: "center", gap: 5 }}><span style={{ width: 10, height: 10, background: rndColor, borderRadius: 2, display: "inline-block" }} /> R&D (RD)</span>
            </div>
          </div>

          <div className="card">
            <div className="card-title">Hours by Employee</div>
            {topEmps.map(([name, hrs]) => (
              <div key={name} style={{ marginBottom: 12 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 14, color: "#1a1f2e" }}>{name}</span>
                  <span style={{ fontSize: 14, color: "#4b5563" }}>{hrs.toFixed(1)} hrs</span>
                </div>
                <div style={{ height: 8, background: "#f0f2f5", borderRadius: 4, overflow: "hidden" }}>
                  <div style={{ width: `${(hrs / maxEmpHrs * 100).toFixed(0)}%`, background: "#1a1f2e", transition: "width .4s" }} />
                </div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="card-title">Hours by Day of Week</div>
            <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80 }}>
              {Object.entries(byDay).map(([day, hrs]) => (
                <div key={day} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
                  <span style={{ fontSize: 12, color: "#4b5563" }}>{hrs > 0 ? hrs.toFixed(0) : ""}</span>
                  <div style={{ width: "100%", background: hrs > 0 ? barColor : "#f0f2f5", borderRadius: "3px 3px 0 0", height: hrs > 0 ? `${(hrs / maxDayHrs * 60).toFixed(0)}px` : "4px", transition: "height .4s", minHeight: 4 }} />
                  <span style={{ fontSize: 11, color: "#6b7280", textAlign: "center" }}>{day.slice(0, 3)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}
      <Footer />
    </div>
  );
}
