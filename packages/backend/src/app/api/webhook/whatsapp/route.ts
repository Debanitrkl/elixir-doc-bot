import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { verifyWhatsAppSignature, checkRateLimit } from "@/lib/auth/middleware";
import {
  parseWebhookMessage,
  sendTextMessage,
  sendAudioByUpload,
  downloadMedia,
  markAsRead,
  IncomingMessage,
} from "@/lib/whatsapp/client";
import { speechToText, translate, textToSpeech } from "@/lib/bhashini/client";
import { generateChatCompletion } from "@/lib/openai/client";
import { buildSystemPrompt, buildConversationMessages } from "@/lib/openai/system-prompts";
import {
  isSupportedLanguage,
  buildLanguageSelectionMessage,
  parseLanguageSelection,
} from "@/lib/bhashini/languages";

/**
 * GET: WhatsApp webhook verification (challenge-response).
 */
export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const mode = searchParams.get("hub.mode");
  const token = searchParams.get("hub.verify_token");
  const challenge = searchParams.get("hub.challenge");

  // Each doctor can set their own verify token, but we use a simple check here
  if (mode === "subscribe" && token && challenge) {
    // Verify against master secret as the verify token
    const masterSecret = process.env.DOCBOT_MASTER_SECRET;
    if (token === masterSecret) {
      return new NextResponse(challenge, { status: 200 });
    }
  }

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}

/**
 * POST: Handle incoming WhatsApp messages.
 * Returns 200 immediately, processes asynchronously.
 */
export async function POST(request: NextRequest) {
  const rawBody = await request.text();

  // Verify webhook signature
  const signature = request.headers.get("x-hub-signature-256");
  if (!verifyWhatsAppSignature(rawBody, signature)) {
    console.error("Invalid WhatsApp webhook signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  const body = JSON.parse(rawBody);

  // Parse the incoming message
  const message = parseWebhookMessage(body);
  if (!message) {
    // Could be a status update, not a message — acknowledge it
    return NextResponse.json({ status: "ok" });
  }

  // Process asynchronously - return 200 immediately to meet WhatsApp's timeout
  processMessage(message).catch((error) => {
    console.error("Message processing error:", error);
  });

  return NextResponse.json({ status: "ok" });
}

/**
 * Main message processing pipeline.
 */
async function processMessage(message: IncomingMessage): Promise<void> {
  const { phoneNumberId, from, messageId, type, text, mediaId } = message;

  // 1. Find the doctor by WhatsApp phone number ID
  const doctor = await prisma.doctor.findUnique({
    where: { whatsappPhoneId: phoneNumberId },
    include: { settings: true },
  });

  if (!doctor || !doctor.settings || !doctor.whatsappToken) {
    console.error(`No doctor found for phoneNumberId: ${phoneNumberId}`);
    return;
  }

  const waConfig = {
    phoneNumberId: doctor.whatsappPhoneId!,
    accessToken: doctor.whatsappToken,
  };

  // Mark as read
  await markAsRead(waConfig, messageId);

  // 2. Deduplicate: check if we've already processed this message
  const existingMsg = await prisma.message.findUnique({
    where: { whatsappMsgId: messageId },
  });
  if (existingMsg) return;

  // 3. Rate limiting (30 msg/min per patient)
  const rateLimited = await checkRateLimit(
    `patient:${from}:min`,
    30,
    60 * 1000
  );
  if (rateLimited) {
    await sendTextMessage(waConfig, from, "You are sending messages too quickly. Please wait a moment.");
    return;
  }

  // 4. Find or create patient
  let patient = await prisma.patient.findUnique({
    where: { doctorId_phone: { doctorId: doctor.id, phone: from } },
  });

  const isNewPatient = !patient;

  if (!patient) {
    patient = await prisma.patient.create({
      data: {
        doctorId: doctor.id,
        phone: from,
        language: "unknown",
      },
    });
  }

  // 5. Handle blocked patients
  if (patient.isBlocked) {
    return; // Silently ignore
  }

  // 6. Handle language selection for new patients
  if (patient.language === "unknown") {
    // Check if this is a language selection response
    if (type === "text" && text) {
      const selectedLang = parseLanguageSelection(text);
      if (selectedLang && isSupportedLanguage(selectedLang)) {
        await prisma.patient.update({
          where: { id: patient.id },
          data: { language: selectedLang },
        });
        patient.language = selectedLang;

        // Send greeting in their language
        const greeting = doctor.settings.greetingMessage;
        let translatedGreeting = greeting;
        if (selectedLang !== "en") {
          try {
            const result = await translate(greeting, "en", selectedLang);
            translatedGreeting = result.translatedText;
          } catch {
            // Fall back to English
          }
        }
        await sendTextMessage(waConfig, from, translatedGreeting);
        return;
      }
    }

    // Send language selection prompt
    if (isNewPatient) {
      await sendTextMessage(waConfig, from, buildLanguageSelectionMessage());
      return;
    }
  }

  // 7. Find or create active conversation
  let conversation = await prisma.conversation.findFirst({
    where: {
      doctorId: doctor.id,
      patientId: patient.id,
      status: { in: ["ACTIVE", "WAITING_DOCTOR"] },
    },
    orderBy: { updatedAt: "desc" },
  });

  if (!conversation) {
    conversation = await prisma.conversation.create({
      data: {
        doctorId: doctor.id,
        patientId: patient.id,
        status: "ACTIVE",
      },
    });
  }

  // 8. Check working hours
  const isOffHours = checkOffHours(doctor.settings);
  if (isOffHours && !doctor.settings.enableAutoReply) {
    // Send off-hours message
    let offHoursMsg = doctor.settings.offHoursMessage;
    if (patient.language !== "en") {
      try {
        const result = await translate(offHoursMsg, "en", patient.language);
        offHoursMsg = result.translatedText;
      } catch { /* fall back to English */ }
    }
    await sendTextMessage(waConfig, from, offHoursMsg);

    // Still store the message
    await storeMessage(conversation.id, "PATIENT", type === "audio" ? "VOICE" : "TEXT", text || "[voice message - off hours]", text || "[voice message - off hours]", patient.language, messageId);
    return;
  }

  // 9. Process the message based on type
  let originalText = "";
  let englishText = "";
  let messageType: "TEXT" | "VOICE" = "TEXT";

  if (type === "text" && text) {
    originalText = text;
    messageType = "TEXT";

    // Translate to English if needed
    if (patient.language !== "en") {
      try {
        const result = await translate(text, patient.language, "en");
        englishText = result.translatedText;
      } catch (error) {
        console.error("Translation error:", error);
        englishText = text; // Fall back to original
      }
    } else {
      englishText = text;
    }
  } else if (type === "audio" && mediaId) {
    messageType = "VOICE";

    try {
      // Download audio
      const { buffer } = await downloadMedia(doctor.whatsappToken, mediaId);
      const audioBase64 = buffer.toString("base64");

      // ASR: speech to text
      const asrLang = patient.language !== "unknown" ? patient.language : "hi"; // Default to Hindi
      const { text: spokenText } = await speechToText(audioBase64, asrLang);
      originalText = spokenText;

      // Translate to English
      if (asrLang !== "en") {
        const result = await translate(spokenText, asrLang, "en");
        englishText = result.translatedText;
      } else {
        englishText = spokenText;
      }
    } catch (error) {
      console.error("Voice processing error:", error);
      await sendTextMessage(
        waConfig,
        from,
        "Sorry, I could not process your voice message. Please try again or send a text message."
      );
      return;
    }
  } else {
    // Unsupported message type
    await sendTextMessage(
      waConfig,
      from,
      "Sorry, I can only process text and voice messages at the moment."
    );
    return;
  }

  // 10. Store patient message
  await storeMessage(
    conversation.id,
    "PATIENT",
    messageType,
    originalText,
    englishText,
    patient.language,
    messageId
  );

  // 11. Generate AI response
  if (!doctor.settings.enableAutoReply) {
    // No auto-reply - set conversation to WAITING_DOCTOR
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "WAITING_DOCTOR" },
    });
    return;
  }

  try {
    // Get conversation history
    const history = await prisma.message.findMany({
      where: { conversationId: conversation.id },
      orderBy: { createdAt: "asc" },
      select: { role: true, contentEnglish: true },
    });

    // Build system prompt
    const systemPrompt = buildSystemPrompt({
      name: doctor.name,
      specialization: doctor.settings.specialization,
      qualifications: doctor.settings.qualifications,
      customPrompt: doctor.settings.systemPrompt,
    });

    // Build messages for GPT
    const gptMessages = buildConversationMessages(
      systemPrompt,
      history,
      englishText
    );

    // Call OpenAI
    const { content: aiResponseEnglish, tokensUsed } = await generateChatCompletion({
      messages: gptMessages,
      model: doctor.settings.gptModel,
    });

    // 12. Translate AI response back to patient's language
    let responseInPatientLang = aiResponseEnglish;
    let audioBase64: string | null = null;

    if (patient.language !== "en") {
      try {
        const translateResult = await translate(aiResponseEnglish, "en", patient.language);
        responseInPatientLang = translateResult.translatedText;
      } catch (error) {
        console.error("Response translation error:", error);
        // Fall back to English
      }

      // Generate TTS if enabled
      if (doctor.settings.enableVoiceReply && messageType === "VOICE") {
        try {
          const ttsResult = await textToSpeech(responseInPatientLang, patient.language);
          audioBase64 = ttsResult.audioBase64;
        } catch (error) {
          console.warn("TTS failed:", error);
        }
      }
    }

    // 13. Send response via WhatsApp
    await sendTextMessage(waConfig, from, responseInPatientLang);

    // Send audio if available
    if (audioBase64) {
      try {
        const audioBuffer = Buffer.from(audioBase64, "base64");
        await sendAudioByUpload(waConfig, from, audioBuffer, "audio/ogg");
      } catch (error) {
        console.warn("Audio send failed:", error);
      }
    }

    // 14. Store AI response
    await storeMessage(
      conversation.id,
      "AI",
      audioBase64 ? "VOICE" : "TEXT",
      responseInPatientLang,
      aiResponseEnglish,
      patient.language,
      undefined,
      tokensUsed
    );

    // Update patient last contact
    await prisma.patient.update({
      where: { id: patient.id },
      data: { lastContactAt: new Date() },
    });
  } catch (error) {
    console.error("AI pipeline error:", error);

    // Notify patient of error
    let errorMsg = "Sorry, I encountered an error processing your message. Please try again.";
    if (patient.language !== "en") {
      try {
        const result = await translate(errorMsg, "en", patient.language);
        errorMsg = result.translatedText;
      } catch { /* use English */ }
    }
    await sendTextMessage(waConfig, from, errorMsg);

    // Set conversation to WAITING_DOCTOR on error
    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { status: "WAITING_DOCTOR" },
    });
  }
}

/**
 * Store a message in the database.
 */
async function storeMessage(
  conversationId: string,
  role: "PATIENT" | "DOCTOR" | "AI" | "SYSTEM",
  type: "TEXT" | "VOICE",
  contentOriginal: string,
  contentEnglish: string,
  languageCode: string,
  whatsappMsgId?: string,
  tokensUsed?: number
) {
  await prisma.message.create({
    data: {
      conversationId,
      role,
      type,
      contentOriginal,
      contentEnglish,
      languageCode,
      whatsappMsgId: whatsappMsgId || undefined,
      tokensUsed: tokensUsed || 0,
    },
  });
}

/**
 * Check if current time is outside working hours.
 */
function checkOffHours(settings: {
  workingHoursStart: string;
  workingHoursEnd: string;
  workingHoursTimezone: string;
}): boolean {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: settings.workingHoursTimezone,
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
    const minute = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);
    const currentMinutes = hour * 60 + minute;

    const [startH, startM] = settings.workingHoursStart.split(":").map(Number);
    const [endH, endM] = settings.workingHoursEnd.split(":").map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes < startMinutes || currentMinutes > endMinutes;
  } catch {
    return false; // Default to working hours if check fails
  }
}
