import { useState, useEffect, useRef, useCallback } from "react";
import "./App.css";
import { auth } from "./lib/db";
import { loadSession, saveSession, clearSession } from "./lib/utils";
import { LOGO_URL, INACTIVITY_MS } from "./lib/config";
import { Toast } from "./components/shared/Toast";
import { HelpModal } from "./components/shared/HelpModal";
import { Login } from "./components/Login";
import { ForgotPasswordScreen } from "./components/ForgotPasswordScreen";
import { ChangePasswordScreen } from "./components/ChangePasswordScreen";
import { ToolmakerForm } from "./components/ToolmakerForm";
import { SupervisorView } from "./components/SupervisorView";
import { HoursDashboard } from "./components/HoursDashboard";
import { FinanceDashboard } from "./components/FinanceDashboard";
import { ProjectCodesManager } from "./components/ProjectCodesManager";
import { AdminView } from "./components/AdminView";
import { AIAssistant } from "./components/AIAssistant";

const tabMap = {
  toolmaker:   [{ id: "log",      label: "Log Time" }],
  cnc:         [{ id: "log",      label: "Log Time" }],
  new_tooling: [{ id: "log",      label: "Log Time" }],
  engineering: [{ id: "log",      label: "Log Time" }],
  it:          [{ id: "log",      label: "Log Time" }],
  automation:  [{ id: "log",      label: "Log Time" }],
  maintenance: [{ id: "log",      label: "Log Time" }],
  quality:     [{ id: "log",      label: "Log Time" }],
  production:  [{ id: "log",      label: "Log Time" }],
  supervisor:  [{ id: "log",      label: "Log Time" }, { id: "review", label: "Review" }],
  finance:     [{ id: "overview", label: "Overview" }, { id: "finance", label: "Export" }, { id: "projects", label: "Codes" }],
  admin:       [{ id: "admin",    label: "Admin"    }, { id: "overview", label: "Overview" }, { id: "finance", label: "Export" }, { id: "projects", label: "Codes" }],
};

export default function App() {
  const [user, setUser] = useState(() => loadSession());
  const [tab, setTab] = useState(null);
  const [toast, setToast] = useState(null);
  const [showHelp, setShowHelp] = useState(false);
  const [showForgot, setShowForgot] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const inactivityTimer = useRef(null);

  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => { window.removeEventListener("online", on); window.removeEventListener("offline", off); };
  }, []);

  const showToast = (msg, type = "success") => setToast({ msg, type });

  useEffect(() => { if (user && !tab) setTab(tabMap[user.role]?.[0]?.id || "log"); }, [user]);

  const resetTimer = useCallback(() => {
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    inactivityTimer.current = setTimeout(async () => {
      if (user?.token) { try { await auth.signOut(user.token); } catch {} }
      clearSession(); setUser(null); setTab(null);
    }, INACTIVITY_MS);
  }, []);

  useEffect(() => {
    if (!user) return;
    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach(e => window.addEventListener(e, resetTimer));
    resetTimer();
    return () => {
      events.forEach(e => window.removeEventListener(e, resetTimer));
      if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
    };
  }, [user, resetTimer]);

  const handleLogin = emp => { setUser(emp); saveSession(emp); setTab(tabMap[emp.role]?.[0]?.id || "log"); };
  const handlePasswordChanged = () => { const u = { ...user, mustChangePassword: false }; setUser(u); saveSession(u); };
  const handleLogout = async () => {
    if (user?.token) { try { await auth.signOut(user.token); } catch {} }
    clearSession(); setUser(null); setTab(null);
    if (inactivityTimer.current) clearTimeout(inactivityTimer.current);
  };

  if (showForgot) return <div className="app"><ForgotPasswordScreen onBack={() => setShowForgot(false)} /></div>;
  if (!user) return <div className="app"><Login onLogin={handleLogin} onForgot={() => setShowForgot(true)} /></div>;
  if (user.mustChangePassword) {
    return (
      <div className="app">
        <ChangePasswordScreen user={user} onDone={handlePasswordChanged} showToast={showToast} />
        {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      </div>
    );
  }

  const roleTabs = tabMap[user.role] || [];

  return (
    <div className="app">
      {showHelp && <HelpModal onClose={() => setShowHelp(false)} />}
      <header className="header" style={{ padding: 0, paddingRight: 14 }}>
        <div style={{ display: "flex", alignItems: "stretch", height: "100%" }}>
          {LOGO_URL && <img src={LOGO_URL} alt="Logo" className="header-logo" style={{ height: 58, objectFit: "contain", padding: "4px 8px 4px 10px" }} />}
          <div style={{ display: "flex", alignItems: "center" }}>
            <div style={{ fontFamily: "'Barlow Condensed',sans-serif", fontSize: 22, fontWeight: 800, letterSpacing: 2, textTransform: "uppercase", color: "#1a1f2e" }}>Euro<span style={{ color: "#c8a84b" }}>Clock</span></div>
          </div>
        </div>
        <div className="header-right">
          <div className="header-user"><strong>{user.name}</strong><span className="header-id"> · {user.id}</span></div>
          <button className="btn-logout" onClick={handleLogout}>Sign Out</button>
        </div>
      </header>
      {!isOnline && (
        <div style={{ background: "#cc4444", color: "#fff", padding: "10px 16px", fontSize: 13, fontWeight: 600, display: "flex", alignItems: "center", gap: 8, justifyContent: "center" }}>
          <span>⚠</span> You're offline — any entries you submit will be saved and sent automatically when you reconnect.
        </div>
      )}
      {roleTabs.length > 1 && (
        <nav className="nav-tabs">
          {roleTabs.map(t => (
            <button key={t.id} className={`nav-tab${tab === t.id ? " active" : ""}`} onClick={() => setTab(t.id)}>{t.label}</button>
          ))}
        </nav>
      )}
      {tab === "log"      && <ToolmakerForm user={user} showToast={showToast} onHelp={() => setShowHelp(true)} isOnline={isOnline} />}
      {tab === "review"   && <SupervisorView user={user} showToast={showToast} onHelp={() => setShowHelp(true)} />}
      {tab === "overview" && <HoursDashboard onHelp={() => setShowHelp(true)} />}
      {tab === "finance"  && <FinanceDashboard onHelp={() => setShowHelp(true)} />}
      {tab === "projects" && <ProjectCodesManager showToast={showToast} onHelp={() => setShowHelp(true)} />}
      {tab === "admin"    && <AdminView showToast={showToast} onHelp={() => setShowHelp(true)} />}
      {toast && <Toast msg={toast.msg} type={toast.type} onDone={() => setToast(null)} />}
      <AIAssistant user={user} />
    </div>
  );
}
