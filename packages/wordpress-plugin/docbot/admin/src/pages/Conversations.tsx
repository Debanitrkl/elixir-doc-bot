import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getConversations } from "../lib/api-client";

const STATUS_OPTIONS = ["", "ACTIVE", "WAITING_DOCTOR", "CLOSED", "ARCHIVED"];

export default function Conversations() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Array<{
    id: string; status: string; patient: { id: string; name: string; phone: string; language: string };
    lastMessage: { contentEnglish: string; role: string; createdAt: string } | null;
    unreadCount: number; _count: { messages: number }; updatedAt: string;
  }>>([]);
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getConversations({ page, status: statusFilter || undefined })
      .then((data) => {
        setConversations(data.conversations);
        setTotalPages(data.pagination.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, statusFilter]);

  return (
    <div>
      <h1 style={styles.heading}>Conversations</h1>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        {STATUS_OPTIONS.map((s) => (
          <button
            key={s}
            onClick={() => { setStatusFilter(s); setPage(1); }}
            style={{
              ...styles.filterBtn,
              backgroundColor: statusFilter === s ? "#3b82f6" : "#f1f5f9",
              color: statusFilter === s ? "#fff" : "#475569",
            }}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : conversations.length === 0 ? (
        <div style={styles.card}>
          <p style={{ color: "#94a3b8", textAlign: "center", padding: 32 }}>No conversations found.</p>
        </div>
      ) : (
        <div>
          {conversations.map((conv) => (
            <div
              key={conv.id}
              style={styles.conversationRow}
              onClick={() => navigate(`/conversations/${conv.id}`)}
            >
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <strong style={{ fontSize: 14 }}>{conv.patient.name}</strong>
                  <span style={styles.statusBadge(conv.status)}>
                    {conv.status.replace("_", " ")}
                  </span>
                  {conv.unreadCount > 0 && (
                    <span style={styles.unreadBadge}>{conv.unreadCount}</span>
                  )}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 2 }}>
                  {conv.patient.phone} &middot; {conv._count.messages} messages
                </div>
                {conv.lastMessage && (
                  <div style={{ fontSize: 13, color: "#374151", marginTop: 6 }}>
                    <strong>{conv.lastMessage.role === "PATIENT" ? "Patient" : conv.lastMessage.role === "AI" ? "AI" : "Doctor"}:</strong>{" "}
                    {conv.lastMessage.contentEnglish.substring(0, 120)}
                    {conv.lastMessage.contentEnglish.length > 120 ? "..." : ""}
                  </div>
                )}
              </div>
              <div style={{ fontSize: 12, color: "#94a3b8", whiteSpace: "nowrap" }}>
                {new Date(conv.updatedAt).toLocaleString()}
              </div>
            </div>
          ))}

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
              <button style={styles.pageBtn} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span style={{ padding: "6px 12px", fontSize: 13 }}>Page {page} of {totalPages}</span>
              <button style={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties | ((...args: unknown[]) => React.CSSProperties)> = {
  heading: { fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: "#0f172a" },
  card: { background: "#fff", borderRadius: 8, padding: 16, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
  filterBtn: {
    padding: "6px 14px",
    border: "none",
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 600,
    cursor: "pointer",
  },
  conversationRow: {
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "space-between",
    padding: "14px 16px",
    background: "#fff",
    borderRadius: 8,
    marginBottom: 8,
    cursor: "pointer",
    boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
    transition: "box-shadow 0.15s",
  },
  statusBadge: (status: string) => {
    const colors: Record<string, { bg: string; text: string }> = {
      ACTIVE: { bg: "#dcfce7", text: "#166534" },
      WAITING_DOCTOR: { bg: "#fef3c7", text: "#92400e" },
      CLOSED: { bg: "#f1f5f9", text: "#475569" },
      ARCHIVED: { bg: "#f1f5f9", text: "#94a3b8" },
    };
    const c = colors[status as string] || colors.CLOSED;
    return { fontSize: 10, padding: "2px 8px", borderRadius: 10, backgroundColor: c.bg, color: c.text, fontWeight: 600 };
  },
  unreadBadge: {
    fontSize: 10,
    padding: "1px 6px",
    borderRadius: 10,
    backgroundColor: "#ef4444",
    color: "#fff",
    fontWeight: 700,
  },
  pageBtn: {
    padding: "6px 16px",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    background: "#fff",
    fontSize: 12,
    cursor: "pointer",
  },
};
