import { HashRouter, Routes, Route, Navigate, NavLink } from "react-router-dom";
import { useState, useEffect } from "react";
import Dashboard from "./pages/Dashboard";
import Conversations from "./pages/Conversations";
import ConversationDetail from "./pages/ConversationDetail";
import Patients from "./pages/Patients";
import PatientDetail from "./pages/PatientDetail";
import Settings from "./pages/Settings";
import Setup from "./pages/Setup";
import { getPluginSettings } from "./lib/api-client";

const navItems = [
  { path: "/", label: "Dashboard", icon: "dashicons-dashboard" },
  { path: "/conversations", label: "Conversations", icon: "dashicons-format-chat" },
  { path: "/patients", label: "Patients", icon: "dashicons-groups" },
  { path: "/settings", label: "Settings", icon: "dashicons-admin-generic" },
];

export default function App() {
  const [isSetup, setIsSetup] = useState<boolean | null>(null);

  useEffect(() => {
    // Check WP-injected data first
    if (window.docbotData?.isSetupComplete) {
      setIsSetup(true);
      return;
    }

    getPluginSettings()
      .then((s) => setIsSetup(s.is_setup_complete))
      .catch(() => setIsSetup(false));
  }, []);

  if (isSetup === null) {
    return <div style={{ padding: 20 }}>Loading...</div>;
  }

  if (!isSetup) {
    return (
      <HashRouter>
        <Setup onComplete={() => setIsSetup(true)} />
      </HashRouter>
    );
  }

  return (
    <HashRouter>
      <div style={{ display: "flex", minHeight: "calc(100vh - 32px)" }}>
        <nav style={styles.sidebar}>
          <div style={styles.logo}>
            <h2 style={{ margin: 0, fontSize: 18, color: "#fff" }}>DocBot</h2>
            <span style={{ fontSize: 11, color: "#94a3b8" }}>AI Medical Assistant</span>
          </div>
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end={item.path === "/"}
              style={({ isActive }) => ({
                ...styles.navLink,
                backgroundColor: isActive ? "rgba(255,255,255,0.1)" : "transparent",
                color: isActive ? "#fff" : "#94a3b8",
              })}
            >
              <span className={`dashicons ${item.icon}`} style={{ marginRight: 8, fontSize: 16 }} />
              {item.label}
            </NavLink>
          ))}
        </nav>

        <main style={styles.main}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/conversations" element={<Conversations />} />
            <Route path="/conversations/:id" element={<ConversationDetail />} />
            <Route path="/patients" element={<Patients />} />
            <Route path="/patients/:id" element={<PatientDetail />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </main>
      </div>
    </HashRouter>
  );
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 220,
    backgroundColor: "#1e293b",
    padding: "0",
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
  },
  logo: {
    padding: "20px 16px",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  navLink: {
    display: "flex",
    alignItems: "center",
    padding: "10px 16px",
    textDecoration: "none",
    fontSize: 13,
    borderRadius: 0,
    transition: "background-color 0.15s",
  },
  main: {
    flex: 1,
    padding: "20px 24px",
    backgroundColor: "#f8fafc",
    overflowY: "auto",
  },
};
