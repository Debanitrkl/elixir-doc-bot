/**
 * API client for the WordPress REST proxy endpoints.
 * Uses WP nonce for authentication.
 */

declare global {
  interface Window {
    docbotData?: {
      restUrl: string;
      nonce: string;
      isSetupComplete: boolean;
      adminUrl: string;
      pluginUrl: string;
    };
  }
}

function getBaseUrl(): string {
  return window.docbotData?.restUrl || "/wp-json/docbot/v1/";
}

function getNonce(): string {
  return window.docbotData?.nonce || "";
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = getBaseUrl() + endpoint;

  const res = await fetch(url, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      "X-WP-Nonce": getNonce(),
      ...options.headers,
    },
  });

  if (!res.ok) {
    const error = await res.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error || `HTTP ${res.status}`);
  }

  return res.json();
}

// Setup
export function registerDoctor(data: {
  backendUrl: string;
  masterSecret: string;
  whatsappPhoneId?: string;
  whatsappToken?: string;
}) {
  return request("setup/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function verifyApiKey(data: { backendUrl: string; apiKey: string }) {
  return request("setup/verify", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

// Plugin settings
export function getPluginSettings() {
  return request<{
    backend_url: string;
    is_setup_complete: boolean;
    has_api_key: boolean;
    doctor_id: string;
  }>("plugin-settings");
}

// Doctor settings (from backend)
export function getSettings() {
  return request<{
    doctor: { id: string; name: string; email: string; whatsappPhoneId: string };
    settings: Record<string, unknown>;
  }>("settings");
}

export function updateSettings(data: Record<string, unknown>) {
  return request("settings", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Stats
export function getStats() {
  return request<{
    stats: {
      totalPatients: number;
      activeConversations: number;
      waitingConversations: number;
      totalMessages: number;
      todayMessages: number;
      unreadCount: number;
    };
    recentConversations: Array<{
      id: string;
      status: string;
      patient: { name: string; phone: string; language: string };
      lastMessage: { contentEnglish: string; role: string; createdAt: string } | null;
      updatedAt: string;
    }>;
    languageDistribution: Array<{ language: string; count: number }>;
  }>("stats");
}

// Patients
export function getPatients(params?: { page?: number; limit?: number; search?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.limit) query.set("limit", String(params.limit));
  if (params?.search) query.set("search", params.search);

  return request<{
    patients: Array<{
      id: string;
      phone: string;
      name: string;
      language: string;
      isBlocked: boolean;
      firstContactAt: string;
      lastContactAt: string;
      _count: { conversations: number };
    }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>("patients?" + query.toString());
}

export function updatePatient(data: {
  patientId: string;
  name?: string;
  isBlocked?: boolean;
  language?: string;
}) {
  return request("patients", {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Conversations
export function getConversations(params?: { page?: number; status?: string }) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));
  if (params?.status) query.set("status", params.status);

  return request<{
    conversations: Array<{
      id: string;
      status: string;
      patient: { id: string; name: string; phone: string; language: string };
      lastMessage: { contentEnglish: string; role: string; createdAt: string; isRead: boolean } | null;
      unreadCount: number;
      _count: { messages: number };
      updatedAt: string;
    }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>("conversations?" + query.toString());
}

export function getConversation(id: string) {
  return request<{
    conversation: {
      id: string;
      status: string;
      subject: string | null;
      patient: { id: string; name: string; phone: string; language: string };
      createdAt: string;
    };
  }>("conversations/" + id);
}

export function updateConversation(id: string, data: { status?: string; subject?: string }) {
  return request("conversations/" + id, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// Messages
export function getMessages(conversationId: string, params?: { page?: number }) {
  const query = new URLSearchParams();
  if (params?.page) query.set("page", String(params.page));

  return request<{
    messages: Array<{
      id: string;
      role: string;
      type: string;
      contentOriginal: string;
      contentEnglish: string;
      languageCode: string;
      audioUrl: string | null;
      createdAt: string;
      tokensUsed: number;
    }>;
    pagination: { page: number; limit: number; total: number; totalPages: number };
  }>("conversations/" + conversationId + "/messages?" + query.toString());
}

export function sendDoctorReply(conversationId: string, content: string) {
  return request("conversations/" + conversationId + "/messages", {
    method: "POST",
    body: JSON.stringify({ content }),
  });
}
