import { useState, useEffect } from "react";
import { getSettings, updateSettings } from "../lib/api-client";

export default function Settings() {
  const [settings, setSettings] = useState<Record<string, unknown>>({});
  const [doctor, setDoctor] = useState<{ id: string; name: string; email: string; whatsappPhoneId: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    getSettings()
      .then((data) => {
        setDoctor(data.doctor);
        setSettings(data.settings);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      await updateSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (error) {
      console.error("Failed to save settings:", error);
    } finally {
      setSaving(false);
    }
  };

  const updateField = (key: string, value: unknown) => {
    setSettings((prev) => ({ ...prev, [key]: value }));
  };

  if (loading) return <div>Loading settings...</div>;

  return (
    <div style={{ maxWidth: 700 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <h1 style={styles.heading}>Settings</h1>
        <button style={styles.saveBtn} disabled={saving} onClick={handleSave}>
          {saving ? "Saving..." : saved ? "Saved!" : "Save Changes"}
        </button>
      </div>

      {doctor && (
        <div style={styles.card}>
          <h3 style={styles.sectionTitle}>Doctor Profile</h3>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Name:</span> {doctor.name}
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>Email:</span> {doctor.email}
          </div>
          <div style={styles.infoRow}>
            <span style={styles.infoLabel}>WhatsApp Phone ID:</span>{" "}
            {doctor.whatsappPhoneId || <em style={{ color: "#94a3b8" }}>Not configured</em>}
          </div>
        </div>
      )}

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Medical Profile</h3>

        <label style={styles.label}>Specialization</label>
        <input
          style={styles.input}
          value={(settings.specialization as string) || ""}
          onChange={(e) => updateField("specialization", e.target.value)}
          placeholder="e.g., General Physician, Cardiologist"
        />

        <label style={styles.label}>Qualifications</label>
        <input
          style={styles.input}
          value={(settings.qualifications as string) || ""}
          onChange={(e) => updateField("qualifications", e.target.value)}
          placeholder="e.g., MBBS, MD"
        />
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>AI Configuration</h3>

        <label style={styles.label}>GPT Model</label>
        <select
          style={styles.input}
          value={(settings.gptModel as string) || "gpt-4o"}
          onChange={(e) => updateField("gptModel", e.target.value)}
        >
          <option value="gpt-4o">GPT-4o (Recommended)</option>
          <option value="gpt-4o-mini">GPT-4o Mini (Faster, cheaper)</option>
          <option value="gpt-4-turbo">GPT-4 Turbo</option>
        </select>

        <label style={styles.label}>Custom System Prompt</label>
        <textarea
          style={{ ...styles.input, minHeight: 100 }}
          value={(settings.systemPrompt as string) || ""}
          onChange={(e) => updateField("systemPrompt", e.target.value)}
          placeholder="Add custom instructions for the AI assistant..."
        />

        <label style={styles.label}>Greeting Message</label>
        <textarea
          style={{ ...styles.input, minHeight: 60 }}
          value={(settings.greetingMessage as string) || ""}
          onChange={(e) => updateField("greetingMessage", e.target.value)}
        />
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Working Hours</h3>

        <div style={{ display: "flex", gap: 16 }}>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>Start Time</label>
            <input
              style={styles.input}
              type="time"
              value={(settings.workingHoursStart as string) || "09:00"}
              onChange={(e) => updateField("workingHoursStart", e.target.value)}
            />
          </div>
          <div style={{ flex: 1 }}>
            <label style={styles.label}>End Time</label>
            <input
              style={styles.input}
              type="time"
              value={(settings.workingHoursEnd as string) || "21:00"}
              onChange={(e) => updateField("workingHoursEnd", e.target.value)}
            />
          </div>
        </div>

        <label style={styles.label}>Off-Hours Message</label>
        <textarea
          style={{ ...styles.input, minHeight: 60 }}
          value={(settings.offHoursMessage as string) || ""}
          onChange={(e) => updateField("offHoursMessage", e.target.value)}
        />
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>Features</h3>

        <label style={styles.toggle}>
          <input
            type="checkbox"
            checked={(settings.enableAutoReply as boolean) ?? true}
            onChange={(e) => updateField("enableAutoReply", e.target.checked)}
          />
          <span>Enable AI Auto-Reply</span>
          <small style={{ display: "block", color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
            When disabled, patient messages will be queued for manual doctor response.
          </small>
        </label>

        <label style={styles.toggle}>
          <input
            type="checkbox"
            checked={(settings.enableVoiceReply as boolean) ?? true}
            onChange={(e) => updateField("enableVoiceReply", e.target.checked)}
          />
          <span>Enable Voice Replies</span>
          <small style={{ display: "block", color: "#94a3b8", fontSize: 12, marginTop: 2 }}>
            Send text-to-speech audio along with text replies.
          </small>
        </label>
      </div>

      <div style={styles.card}>
        <h3 style={styles.sectionTitle}>WhatsApp Configuration</h3>

        <label style={styles.label}>Phone Number ID</label>
        <input
          style={styles.input}
          value={(settings.whatsappPhoneId as string) || ""}
          onChange={(e) => updateField("whatsappPhoneId", e.target.value)}
          placeholder="From Meta Developer Console"
        />

        <label style={styles.label}>Access Token</label>
        <input
          style={styles.input}
          type="password"
          value={(settings.whatsappToken as string) || ""}
          onChange={(e) => updateField("whatsappToken", e.target.value)}
          placeholder="Permanent WhatsApp access token"
        />
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  heading: { fontSize: 22, fontWeight: 700, margin: 0, color: "#0f172a" },
  card: { background: "#fff", borderRadius: 8, padding: 20, boxShadow: "0 1px 2px rgba(0,0,0,0.05)", marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: 600, margin: "0 0 16px", color: "#1e293b" },
  label: { display: "block", fontSize: 13, fontWeight: 600, color: "#374151", marginBottom: 4, marginTop: 16 },
  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    boxSizing: "border-box" as const,
    fontFamily: "inherit",
  },
  saveBtn: {
    padding: "8px 24px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  toggle: {
    display: "block",
    padding: "12px 0",
    borderBottom: "1px solid #f1f5f9",
    cursor: "pointer",
    fontSize: 14,
  },
  infoRow: {
    fontSize: 13,
    padding: "6px 0",
    borderBottom: "1px solid #f1f5f9",
  },
  infoLabel: {
    fontWeight: 600,
    color: "#64748b",
    display: "inline-block",
    width: 160,
  },
};
