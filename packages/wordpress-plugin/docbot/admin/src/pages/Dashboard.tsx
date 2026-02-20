import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getStats } from "../lib/api-client";

const LANGUAGE_NAMES: Record<string, string> = {
  hi: "Hindi", bn: "Bengali", ta: "Tamil", te: "Telugu", mr: "Marathi",
  gu: "Gujarati", kn: "Kannada", ml: "Malayalam", pa: "Punjabi", or: "Odia",
  as: "Assamese", ur: "Urdu", en: "English", unknown: "Not set",
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [data, setData] = useState<Awaited<ReturnType<typeof getStats>> | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getStats().then(setData).catch(console.error).finally(() => setLoading(false));
  }, []);

  if (loading) return <div>Loading dashboard...</div>;
  if (!data) return <div>Failed to load dashboard data.</div>;

  const { stats, recentConversations, languageDistribution } = data;

  return (
    <div>
      <h1 style={styles.heading}>Dashboard</h1>

      <div style={styles.grid}>
        <StatCard label="Total Patients" value={stats.totalPatients} color="#3b82f6" />
        <StatCard label="Active Conversations" value={stats.activeConversations} color="#10b981" />
        <StatCard label="Waiting for Doctor" value={stats.waitingConversations} color="#f59e0b" />
        <StatCard label="Unread Messages" value={stats.unreadCount} color="#ef4444" />
        <StatCard label="Messages Today" value={stats.todayMessages} color="#8b5cf6" />
        <StatCard label="Total Messages" value={stats.totalMessages} color="#64748b" />
      </div>

      <div style={{ display: "flex", gap: 24, marginTop: 24 }}>
        <div style={{ ...styles.card, flex: 2 }}>
          <h3 style={styles.cardTitle}>Recent Conversations</h3>
          {recentConversations.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>No conversations yet.</p>
          ) : (
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Patient</th>
                  <th style={styles.th}>Status</th>
                  <th style={styles.th}>Last Message</th>
                  <th style={styles.th}>Time</th>
                </tr>
              </thead>
              <tbody>
                {recentConversations.map((conv) => (
                  <tr
                    key={conv.id}
                    style={styles.tr}
                    onClick={() => navigate(`/conversations/${conv.id}`)}
                  >
                    <td style={styles.td}>
                      <strong>{conv.patient.name}</strong>
                      <br />
                      <span style={{ fontSize: 11, color: "#94a3b8" }}>
                        {conv.patient.phone} ({LANGUAGE_NAMES[conv.patient.language] || conv.patient.language})
                      </span>
                    </td>
                    <td style={styles.td}>
                      <StatusBadge status={conv.status} />
                    </td>
                    <td style={{ ...styles.td, maxWidth: 200, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {conv.lastMessage ? (
                        <span style={{ fontSize: 12 }}>
                          <strong>{conv.lastMessage.role === "PATIENT" ? "Patient" : "AI"}:</strong>{" "}
                          {conv.lastMessage.contentEnglish.substring(0, 80)}
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>No messages</span>
                      )}
                    </td>
                    <td style={{ ...styles.td, fontSize: 12, color: "#94a3b8" }}>
                      {formatTime(conv.updatedAt)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ ...styles.card, flex: 1 }}>
          <h3 style={styles.cardTitle}>Languages</h3>
          {languageDistribution.length === 0 ? (
            <p style={{ color: "#94a3b8", fontSize: 13 }}>No data yet.</p>
          ) : (
            <div>
              {languageDistribution.map((lang) => (
                <div key={lang.language} style={{ display: "flex", justifyContent: "space-between", padding: "6px 0", borderBottom: "1px solid #f1f5f9" }}>
                  <span style={{ fontSize: 13 }}>{LANGUAGE_NAMES[lang.language] || lang.language}</span>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>{lang.count}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ ...styles.card, borderTop: `3px solid ${color}` }}>
      <div style={{ fontSize: 28, fontWeight: 700, color }}>{value}</div>
      <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>{label}</div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, { bg: string; text: string }> = {
    ACTIVE: { bg: "#dcfce7", text: "#166534" },
    WAITING_DOCTOR: { bg: "#fef3c7", text: "#92400e" },
    CLOSED: { bg: "#f1f5f9", text: "#475569" },
    ARCHIVED: { bg: "#f1f5f9", text: "#94a3b8" },
  };
  const c = colors[status] || colors.CLOSED;
  return (
    <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, backgroundColor: c.bg, color: c.text, fontWeight: 600 }}>
      {status.replace("_", " ")}
    </span>
  );
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const diff = now.getTime() - d.getTime();
  if (diff < 60000) return "just now";
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return d.toLocaleDateString();
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: "#0f172a" },
  grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 16 },
  card: { background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
  cardTitle: { fontSize: 14, fontWeight: 600, margin: "0 0 12px", color: "#1e293b" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "8px 12px", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const },
  td: { padding: "10px 12px", borderBottom: "1px solid #f1f5f9" },
  tr: { cursor: "pointer", transition: "background-color 0.1s" },
};
