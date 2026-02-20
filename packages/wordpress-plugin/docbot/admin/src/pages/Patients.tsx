import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { getPatients } from "../lib/api-client";

export default function Patients() {
  const navigate = useNavigate();
  const [patients, setPatients] = useState<Array<{
    id: string; phone: string; name: string; language: string;
    isBlocked: boolean; firstContactAt: string; lastContactAt: string;
    _count: { conversations: number };
  }>>([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    getPatients({ page, search: search || undefined })
      .then((data) => {
        setPatients(data.patients);
        setTotalPages(data.pagination.totalPages);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, search]);

  return (
    <div>
      <h1 style={styles.heading}>Patients</h1>

      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          placeholder="Search by name or phone..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          style={styles.searchInput}
        />
      </div>

      {loading ? (
        <div>Loading...</div>
      ) : patients.length === 0 ? (
        <div style={styles.card}>
          <p style={{ color: "#94a3b8", textAlign: "center", padding: 32 }}>No patients found.</p>
        </div>
      ) : (
        <>
          <div style={styles.card}>
            <table style={styles.table}>
              <thead>
                <tr>
                  <th style={styles.th}>Name</th>
                  <th style={styles.th}>Phone</th>
                  <th style={styles.th}>Language</th>
                  <th style={styles.th}>Conversations</th>
                  <th style={styles.th}>Last Contact</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {patients.map((p) => (
                  <tr
                    key={p.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => navigate(`/patients/${p.id}`)}
                  >
                    <td style={styles.td}><strong>{p.name}</strong></td>
                    <td style={{ ...styles.td, fontFamily: "monospace", fontSize: 12 }}>{p.phone}</td>
                    <td style={styles.td}>{p.language.toUpperCase()}</td>
                    <td style={styles.td}>{p._count.conversations}</td>
                    <td style={{ ...styles.td, fontSize: 12, color: "#64748b" }}>
                      {new Date(p.lastContactAt).toLocaleDateString()}
                    </td>
                    <td style={styles.td}>
                      {p.isBlocked ? (
                        <span style={{ color: "#dc2626", fontSize: 12, fontWeight: 600 }}>Blocked</span>
                      ) : (
                        <span style={{ color: "#16a34a", fontSize: 12, fontWeight: 600 }}>Active</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div style={{ display: "flex", justifyContent: "center", gap: 8, marginTop: 16 }}>
              <button style={styles.pageBtn} disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
              <span style={{ padding: "6px 12px", fontSize: 13 }}>Page {page} of {totalPages}</span>
              <button style={styles.pageBtn} disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 22, fontWeight: 700, margin: "0 0 20px", color: "#0f172a" },
  searchInput: {
    width: 300,
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
  },
  card: { background: "#fff", borderRadius: 8, padding: 0, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", overflow: "hidden" },
  table: { width: "100%", borderCollapse: "collapse" as const, fontSize: 13 },
  th: { textAlign: "left" as const, padding: "10px 14px", borderBottom: "1px solid #e2e8f0", color: "#64748b", fontSize: 11, fontWeight: 600, textTransform: "uppercase" as const, backgroundColor: "#f8fafc" },
  td: { padding: "10px 14px", borderBottom: "1px solid #f1f5f9" },
  pageBtn: {
    padding: "6px 16px",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    background: "#fff",
    fontSize: 12,
    cursor: "pointer",
  },
};
