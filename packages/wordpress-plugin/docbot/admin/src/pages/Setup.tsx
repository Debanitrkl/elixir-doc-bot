import { useState } from "react";
import { registerDoctor, verifyApiKey } from "../lib/api-client";

interface SetupProps {
  onComplete: () => void;
}

export default function Setup({ onComplete }: SetupProps) {
  const [step, setStep] = useState(1);
  const [mode, setMode] = useState<"register" | "existing" | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // Form fields
  const [backendUrl, setBackendUrl] = useState("");
  const [masterSecret, setMasterSecret] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [whatsappPhoneId, setWhatsappPhoneId] = useState("");
  const [whatsappToken, setWhatsappToken] = useState("");

  const handleRegister = async () => {
    setLoading(true);
    setError("");
    try {
      await registerDoctor({
        backendUrl: backendUrl.replace(/\/$/, ""),
        masterSecret,
        whatsappPhoneId: whatsappPhoneId || undefined,
        whatsappToken: whatsappToken || undefined,
      });
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async () => {
    setLoading(true);
    setError("");
    try {
      await verifyApiKey({
        backendUrl: backendUrl.replace(/\/$/, ""),
        apiKey,
      });
      onComplete();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={styles.container}>
      <div style={styles.card}>
        <h1 style={styles.title}>Welcome to DocBot</h1>
        <p style={styles.subtitle}>
          Set up your AI-powered WhatsApp medical consultation assistant.
        </p>

        {step === 1 && (
          <div>
            <h3 style={styles.stepTitle}>Step 1: Connection Type</h3>
            <p>How would you like to connect?</p>
            <div style={styles.buttonGroup}>
              <button
                style={{ ...styles.optionButton, ...(mode === "register" ? styles.optionActive : {}) }}
                onClick={() => { setMode("register"); setStep(2); }}
              >
                <strong>New Registration</strong>
                <br />
                <small>Register as a new doctor on the DocBot platform</small>
              </button>
              <button
                style={{ ...styles.optionButton, ...(mode === "existing" ? styles.optionActive : {}) }}
                onClick={() => { setMode("existing"); setStep(2); }}
              >
                <strong>Existing API Key</strong>
                <br />
                <small>I already have a DocBot API key</small>
              </button>
            </div>
          </div>
        )}

        {step === 2 && (
          <div>
            <h3 style={styles.stepTitle}>Step 2: Connect to Backend</h3>

            <label style={styles.label}>Backend URL</label>
            <input
              style={styles.input}
              type="url"
              placeholder="https://your-docbot.vercel.app"
              value={backendUrl}
              onChange={(e) => setBackendUrl(e.target.value)}
            />

            {mode === "register" && (
              <>
                <label style={styles.label}>Master Secret</label>
                <input
                  style={styles.input}
                  type="password"
                  placeholder="Your master secret from Vercel env"
                  value={masterSecret}
                  onChange={(e) => setMasterSecret(e.target.value)}
                />

                <h3 style={{ ...styles.stepTitle, marginTop: 24 }}>WhatsApp Configuration (Optional)</h3>
                <p style={{ fontSize: 13, color: "#64748b" }}>
                  You can configure this later in Settings.
                </p>

                <label style={styles.label}>WhatsApp Phone Number ID</label>
                <input
                  style={styles.input}
                  type="text"
                  placeholder="From Meta Developer Console"
                  value={whatsappPhoneId}
                  onChange={(e) => setWhatsappPhoneId(e.target.value)}
                />

                <label style={styles.label}>WhatsApp Access Token</label>
                <input
                  style={styles.input}
                  type="password"
                  placeholder="Permanent access token"
                  value={whatsappToken}
                  onChange={(e) => setWhatsappToken(e.target.value)}
                />
              </>
            )}

            {mode === "existing" && (
              <>
                <label style={styles.label}>API Key</label>
                <input
                  style={styles.input}
                  type="password"
                  placeholder="docbot_..."
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                />
              </>
            )}

            {error && <p style={styles.error}>{error}</p>}

            <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
              <button style={styles.secondaryButton} onClick={() => setStep(1)}>
                Back
              </button>
              <button
                style={styles.primaryButton}
                disabled={loading || !backendUrl}
                onClick={mode === "register" ? handleRegister : handleVerify}
              >
                {loading ? "Connecting..." : mode === "register" ? "Register & Connect" : "Verify & Connect"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    minHeight: "80vh",
    padding: 20,
  },
  card: {
    background: "#fff",
    borderRadius: 12,
    padding: "40px 48px",
    maxWidth: 560,
    width: "100%",
    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
  },
  title: {
    margin: "0 0 8px",
    fontSize: 24,
    fontWeight: 700,
    color: "#0f172a",
  },
  subtitle: {
    color: "#64748b",
    fontSize: 14,
    marginBottom: 32,
  },
  stepTitle: {
    fontSize: 16,
    fontWeight: 600,
    marginBottom: 12,
    color: "#1e293b",
  },
  buttonGroup: {
    display: "flex",
    gap: 12,
    marginTop: 16,
  },
  optionButton: {
    flex: 1,
    padding: "16px",
    border: "2px solid #e2e8f0",
    borderRadius: 8,
    background: "#fff",
    cursor: "pointer",
    textAlign: "left" as const,
    fontSize: 13,
    transition: "border-color 0.15s",
  },
  optionActive: {
    borderColor: "#3b82f6",
    backgroundColor: "#eff6ff",
  },
  label: {
    display: "block",
    fontSize: 13,
    fontWeight: 600,
    color: "#374151",
    marginBottom: 4,
    marginTop: 16,
  },
  input: {
    width: "100%",
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 6,
    fontSize: 14,
    boxSizing: "border-box" as const,
  },
  primaryButton: {
    padding: "10px 24px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 14,
    fontWeight: 600,
    cursor: "pointer",
  },
  secondaryButton: {
    padding: "10px 24px",
    backgroundColor: "#f1f5f9",
    color: "#475569",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    fontSize: 14,
    cursor: "pointer",
  },
  error: {
    color: "#dc2626",
    fontSize: 13,
    marginTop: 12,
    padding: "8px 12px",
    backgroundColor: "#fef2f2",
    borderRadius: 6,
  },
};
