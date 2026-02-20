const GRAPH_API_BASE = "https://graph.facebook.com/v21.0";

interface WhatsAppConfig {
  phoneNumberId: string;
  accessToken: string;
}

interface SendMessageResult {
  messageId: string;
}

/**
 * Send a text message via WhatsApp Cloud API.
 */
export async function sendTextMessage(
  config: WhatsAppConfig,
  to: string,
  text: string
): Promise<SendMessageResult> {
  const res = await fetch(
    `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "text",
        text: { body: text },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp send text failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return { messageId: data.messages?.[0]?.id };
}

/**
 * Send an audio message via WhatsApp Cloud API.
 */
export async function sendAudioMessage(
  config: WhatsAppConfig,
  to: string,
  audioUrl: string
): Promise<SendMessageResult> {
  const res = await fetch(
    `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "audio",
        audio: { link: audioUrl },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp send audio failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return { messageId: data.messages?.[0]?.id };
}

/**
 * Send typing indicator ("recording" for voice, "typing" for text).
 */
export async function sendTypingIndicator(
  config: WhatsAppConfig,
  to: string
): Promise<void> {
  await fetch(`${GRAPH_API_BASE}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "reaction",
      status: "read",
    }),
  }).catch(() => {}); // Non-critical, ignore errors
}

/**
 * Mark message as read.
 */
export async function markAsRead(
  config: WhatsAppConfig,
  messageId: string
): Promise<void> {
  await fetch(`${GRAPH_API_BASE}/${config.phoneNumberId}/messages`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      status: "read",
      message_id: messageId,
    }),
  }).catch(() => {});
}

/**
 * Download media from WhatsApp. First gets the URL, then downloads the binary.
 */
export async function downloadMedia(
  accessToken: string,
  mediaId: string
): Promise<{ buffer: Buffer; mimeType: string }> {
  // Step 1: Get media URL
  const urlRes = await fetch(`${GRAPH_API_BASE}/${mediaId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!urlRes.ok) {
    throw new Error(`Failed to get media URL: ${urlRes.status}`);
  }

  const { url, mime_type } = await urlRes.json();

  // Step 2: Download the actual media
  const mediaRes = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (!mediaRes.ok) {
    throw new Error(`Failed to download media: ${mediaRes.status}`);
  }

  const arrayBuffer = await mediaRes.arrayBuffer();
  return {
    buffer: Buffer.from(arrayBuffer),
    mimeType: mime_type,
  };
}

/**
 * Upload media to WhatsApp and get a media ID.
 */
export async function uploadMedia(
  config: WhatsAppConfig,
  buffer: Buffer,
  mimeType: string,
  filename: string
): Promise<string> {
  const formData = new FormData();
  formData.append("messaging_product", "whatsapp");
  formData.append("type", mimeType);
  formData.append(
    "file",
    new Blob([new Uint8Array(buffer)], { type: mimeType }),
    filename
  );

  const res = await fetch(
    `${GRAPH_API_BASE}/${config.phoneNumberId}/media`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
      },
      body: formData,
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp upload media failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return data.id;
}

/**
 * Send audio by uploading first, then sending the media ID.
 */
export async function sendAudioByUpload(
  config: WhatsAppConfig,
  to: string,
  audioBuffer: Buffer,
  mimeType: string = "audio/ogg"
): Promise<SendMessageResult> {
  const mediaId = await uploadMedia(config, audioBuffer, mimeType, "response.ogg");

  const res = await fetch(
    `${GRAPH_API_BASE}/${config.phoneNumberId}/messages`,
    {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to,
        type: "audio",
        audio: { id: mediaId },
      }),
    }
  );

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`WhatsApp send audio failed: ${res.status} ${err}`);
  }

  const data = await res.json();
  return { messageId: data.messages?.[0]?.id };
}

/**
 * Parse incoming webhook payload to extract message details.
 */
export interface IncomingMessage {
  from: string;       // sender phone number
  messageId: string;
  timestamp: string;
  type: "text" | "audio" | "image" | "interactive" | "button" | "unknown";
  text?: string;
  mediaId?: string;
  mimeType?: string;
  phoneNumberId: string;
}

export function parseWebhookMessage(body: Record<string, unknown>): IncomingMessage | null {
  try {
    const entry = (body.entry as Array<Record<string, unknown>>)?.[0];
    const changes = (entry?.changes as Array<Record<string, unknown>>)?.[0];
    const value = changes?.value as Record<string, unknown>;

    if (!value) return null;

    const metadata = value.metadata as Record<string, string>;
    const phoneNumberId = metadata?.phone_number_id;

    const messages = value.messages as Array<Record<string, unknown>>;
    if (!messages || messages.length === 0) return null;

    const msg = messages[0];
    const type = msg.type as string;
    const from = msg.from as string;
    const messageId = msg.id as string;
    const timestamp = msg.timestamp as string;

    const result: IncomingMessage = {
      from,
      messageId,
      timestamp,
      type: ["text", "audio", "image"].includes(type) ? type as IncomingMessage["type"] : "unknown",
      phoneNumberId,
    };

    if (type === "text") {
      result.text = (msg.text as Record<string, string>)?.body;
    } else if (type === "audio") {
      const audio = msg.audio as Record<string, string>;
      result.mediaId = audio?.id;
      result.mimeType = audio?.mime_type;
    } else if (type === "image") {
      const image = msg.image as Record<string, string>;
      result.mediaId = image?.id;
      result.mimeType = image?.mime_type;
    }

    return result;
  } catch {
    return null;
  }
}
