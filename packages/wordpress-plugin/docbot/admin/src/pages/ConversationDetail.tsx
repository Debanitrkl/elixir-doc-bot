import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getConversation, getMessages, sendDoctorReply, updateConversation } from "../lib/api-client";

interface Message {
  id: string;
  role: string;
  type: string;
  contentOriginal: string;
  contentEnglish: string;
  languageCode: string;
  createdAt: string;
  tokensUsed: number;
}

export default function ConversationDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [conversation, setConversation] = useState<{
    id: string; status: string; subject: string | null;
    patient: { id: string; name: string; phone: string; language: string };
  } | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [replyText, setReplyText] = useState("");
  const [sending, setSending] = useState(false);
  const [showOriginal, setShowOriginal] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    Promise.all([
      getConversation(id),
      getMessages(id),
    ]).then(([convData, msgData]) => {
      setConversation(convData.conversation);
      setMessages(msgData.messages);
    }).catch(console.error).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Poll for new messages every 10s
  useEffect(() => {
    if (!id) return;
    const interval = setInterval(() => {
      getMessages(id).then((data) => setMessages(data.messages)).catch(() => {});
    }, 10000);
    return () => clearInterval(interval);
  }, [id]);

  const handleSendReply = async () => {
    if (!id || !replyText.trim() || sending) return;
    setSending(true);
    try {
      await sendDoctorReply(id, replyText.trim());
      setReplyText("");
      // Refresh messages
      const data = await getMessages(id);
      setMessages(data.messages);
    } catch (error) {
      console.error("Failed to send reply:", error);
    } finally {
      setSending(false);
    }
  };

  const handleCloseConversation = async () => {
    if (!id) return;
    await updateConversation(id, { status: "CLOSED" });
    setConversation((prev) => prev ? { ...prev, status: "CLOSED" } : null);
  };

  if (loading) return <div>Loading conversation...</div>;
  if (!conversation) return <div>Conversation not found.</div>;

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 112px)" }}>
      {/* Header */}
      <div style={styles.header}>
        <div>
          <button onClick={() => navigate("/conversations")} style={styles.backBtn}>
            &larr; Back
          </button>
          <strong style={{ fontSize: 16 }}>{conversation.patient.name}</strong>
          <span style={{ fontSize: 12, color: "#64748b", marginLeft: 8 }}>
            {conversation.patient.phone} &middot; {conversation.patient.language.toUpperCase()}
          </span>
          <span style={{
            ...styles.badge,
            backgroundColor: conversation.status === "ACTIVE" ? "#dcfce7" :
              conversation.status === "WAITING_DOCTOR" ? "#fef3c7" : "#f1f5f9",
            color: conversation.status === "ACTIVE" ? "#166534" :
              conversation.status === "WAITING_DOCTOR" ? "#92400e" : "#475569",
            marginLeft: 8,
          }}>
            {conversation.status.replace("_", " ")}
          </span>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
            <input type="checkbox" checked={showOriginal} onChange={(e) => setShowOriginal(e.target.checked)} />
            Show original language
          </label>
          {conversation.status !== "CLOSED" && (
            <button style={styles.closeBtn} onClick={handleCloseConversation}>
              Close Conversation
            </button>
          )}
        </div>
      </div>

      {/* Messages */}
      <div style={styles.messagesContainer}>
        {messages.map((msg) => (
          <div key={msg.id} style={{
            ...styles.messageBubble,
            alignSelf: msg.role === "PATIENT" ? "flex-start" : "flex-end",
            backgroundColor: msg.role === "PATIENT" ? "#fff" :
              msg.role === "DOCTOR" ? "#dbeafe" : "#f0fdf4",
            borderColor: msg.role === "PATIENT" ? "#e2e8f0" :
              msg.role === "DOCTOR" ? "#93c5fd" : "#86efac",
          }}>
            <div style={{ fontSize: 10, color: "#94a3b8", marginBottom: 4, display: "flex", justifyContent: "space-between" }}>
              <strong>
                {msg.role === "PATIENT" ? "Patient" : msg.role === "DOCTOR" ? "Doctor" : "AI Assistant"}
              </strong>
              <span>{new Date(msg.createdAt).toLocaleTimeString()}</span>
            </div>
            <div style={{ fontSize: 14, lineHeight: 1.5 }}>
              {msg.contentEnglish}
            </div>
            {showOriginal && msg.contentOriginal !== msg.contentEnglish && (
              <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, paddingTop: 6, borderTop: "1px solid rgba(0,0,0,0.06)" }}>
                <em>Original ({msg.languageCode}):</em> {msg.contentOriginal}
              </div>
            )}
            {msg.type === "VOICE" && (
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 4 }}>
                [Voice message]
              </div>
            )}
            {msg.tokensUsed > 0 && (
              <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 2 }}>
                {msg.tokensUsed} tokens
              </div>
            )}
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      {/* Reply box */}
      {conversation.status !== "CLOSED" && conversation.status !== "ARCHIVED" && (
        <div style={styles.replyBox}>
          <textarea
            style={styles.textarea}
            placeholder="Type your reply in English... (It will be translated to the patient's language)"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendReply();
              }
            }}
            rows={2}
          />
          <button
            style={styles.sendBtn}
            disabled={!replyText.trim() || sending}
            onClick={handleSendReply}
          >
            {sending ? "Sending..." : "Send Reply"}
          </button>
        </div>
      )}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    padding: "12px 0",
    borderBottom: "1px solid #e2e8f0",
    marginBottom: 8,
  },
  backBtn: {
    background: "none",
    border: "none",
    color: "#3b82f6",
    cursor: "pointer",
    fontSize: 13,
    marginRight: 12,
    padding: 0,
  },
  badge: {
    fontSize: 10,
    padding: "2px 8px",
    borderRadius: 10,
    fontWeight: 600,
  },
  closeBtn: {
    padding: "4px 12px",
    border: "1px solid #e2e8f0",
    borderRadius: 6,
    background: "#fff",
    fontSize: 12,
    cursor: "pointer",
    color: "#64748b",
  },
  messagesContainer: {
    flex: 1,
    overflowY: "auto",
    display: "flex",
    flexDirection: "column",
    gap: 8,
    padding: "12px 0",
  },
  messageBubble: {
    maxWidth: "70%",
    padding: "10px 14px",
    borderRadius: 12,
    border: "1px solid",
  },
  replyBox: {
    display: "flex",
    gap: 8,
    padding: "12px 0",
    borderTop: "1px solid #e2e8f0",
  },
  textarea: {
    flex: 1,
    padding: "8px 12px",
    border: "1px solid #d1d5db",
    borderRadius: 8,
    fontSize: 14,
    resize: "none" as const,
    fontFamily: "inherit",
  },
  sendBtn: {
    padding: "8px 20px",
    backgroundColor: "#3b82f6",
    color: "#fff",
    border: "none",
    borderRadius: 8,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
    alignSelf: "flex-end",
  },
};
