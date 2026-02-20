import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getPatients, updatePatient, getConversations } from "../lib/api-client";

export default function PatientDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [patient, setPatient] = useState<{
    id: string; phone: string; name: string; language: string;
    isBlocked: boolean; firstContactAt: string; lastContactAt: string;
  } | null>(null);
  const [conversations, setConversations] = useState<Array<{
    id: string; status: string; updatedAt: string;
    lastMessage: { contentEnglish: string; role: string; createdAt: string } | null;
    _count: { messages: number };
  }>>([]);
  const [editName, setEditName] = useState("");
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    // Load patient (we fetch from list and find by id)
    getPatients({ limit: 1, search: id })
      .then((data) => {
        // This is a workaround - ideally we'd have a GET /patients/:id endpoint
        const p = data.patients.find((p) => p.id === id);
        if (p) {
          setPatient(p);
          setEditName(p.name);
        }
      })
      .catch(console.error);

    getConversations()
      .then((data) => {
        // Filter conversations for this patient
        setConversations(
          data.conversations.filter((c) => c.patient.id === id)
        );
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [id]);

  const handleSaveName = async () => {
    if (!id || !editName.trim() || saving) return;
    setSaving(true);
    try {
      await updatePatient({ patientId: id, name: editName.trim() });
      setPatient((prev) => prev ? { ...prev, name: editName.trim() } : null);
    } catch (error) {
      console.error("Failed to update name:", error);
    } finally {
      setSaving(false);
    }
  };

  const handleToggleBlock = async () => {
    if (!id || !patient) return;
    try {
      await updatePatient({ patientId: id, isBlocked: !patient.isBlocked });
      setPatient((prev) => prev ? { ...prev, isBlocked: !prev.isBlocked } : null);
    } catch (error) {
      console.error("Failed to toggle block:", error);
    }
  };

  if (loading) return <div>Loading...</div>;
  if (!patient) return <div>Patient not found.</div>;

  return (
    <div>
      <button onClick={() => navigate("/patients")} style={styles.backBtn}>
        &larr; Back to Patients
      </button>

      <div style={{ display: "flex", gap: 24, marginTop: 16 }}>
        <div style={{ ...styles.card, flex: 1 }}>
          <h2 style={styles.heading}>Patient Details</h2>

          <div style={styles.field}>
            <label style={styles.label}>Name</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input
                style={styles.input}
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
              <button
                style={styles.saveBtn}
                disabled={editName === patient.name || saving}
                onClick={handleSaveName}
              >
                {saving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Phone</label>
            <div style={{ fontFamily: "monospace", fontSize: 14 }}>{patient.phone}</div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Language</label>
            <div>{patient.language.toUpperCase()}</div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>First Contact</label>
            <div style={{ fontSize: 13 }}>{new Date(patient.firstContactAt).toLocaleString()}</div>
          </div>

          <div style={styles.field}>
            <label style={styles.label}>Last Contact</label>
            <div style={{ fontSize: 13 }}>{new Date(patient.lastContactAt).toLocaleString()}</div>
          </div>

          <div style={{ marginTop: 20, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
            <button
              style={{
                ...styles.blockBtn,
                backgroundColor: patient.isBlocked ? "#dcfce7" : "#fef2f2",
                color: patient.isBlocked ? "#166534" : "#dc2626",
              }}
              onClick={handleToggleBlock}
            >
              {patient.isBlocked ? "Unblock Patient" : "Block Patient"}
            </button>
          </div>
        </div>

        <div style={{ ...styles.card, flex: 2 }}>
          <h3 style={{ fontSize: 16, fontWeight: 600, margin: "0 0 12px" }}>Conversations</h3>
          {conversations.length === 0 ? (
            <p style={{ color: "#94a3b8" }}>No conversations.</p>
          ) : (
            conversations.map((conv) => (
              <div
                key={conv.id}
                style={styles.convRow}
                onClick={() => navigate(`/conversations/${conv.id}`)}
              >
                <div>
                  <span style={{ fontSize: 11, padding: "2px 8px", borderRadius: 10, backgroundColor: "#f1f5f9", color: "#475569", fontWeight: 600 }}>
                    {conv.status}
                  </span>
                  <span style={{ fontSize: 12, color: "#94a3b8", marginLeft: 8 }}>
                    {conv._count.messages} messages
                  </span>
                </div>
                {conv.lastMessage && (
                  <div style={{ fontSize: 13, marginTop: 4 }}>
                    {conv.lastMessage.contentEnglish.substring(0, 100)}...
                  </div>
                )}
                <div style={{ fontSize: 11, color: "#94a3b8", marginTop: 4 }}>
                  {new Date(conv.updatedAt).toLocaleString()}
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 18, fontWeight: 700, margin: "0 0 20px", color: "#0f172a" },
  backBtn: { background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: 13, padding: 0 },
  card: { background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,0.05)" },
  field: { marginBottom: 16 },
  label: { display: "block", fontSize: 12, fontWeight: 600, color: "#64748b", marginBottom: 4 },
  input: { padding: "6px 10px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: 14, flex: 1 },
  saveBtn: { padding: "6px 16px", backgroundColor: "#3b82f6", color: "#fff", border: "none", borderRadius: 6, fontSize: 13, cursor: "pointer" },
  blockBtn: { padding: "8px 16px", border: "none", borderRadius: 6, fontSize: 13, fontWeight: 600, cursor: "pointer" },
  convRow: { padding: "12px 0", borderBottom: "1px solid #f1f5f9", cursor: "pointer" },
};
