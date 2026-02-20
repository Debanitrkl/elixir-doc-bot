import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authenticateDoctor } from "@/lib/auth/middleware";
import { sendTextMessage, sendAudioByUpload } from "@/lib/whatsapp/client";
import { translate, textToSpeech } from "@/lib/bhashini/client";
import { logAudit } from "@/lib/utils/audit";

/**
 * GET /api/conversations/[id]/messages - Get messages for a conversation.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authenticateDoctor(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = params;
  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 200);

  // Verify conversation belongs to this doctor
  const conversation = await prisma.conversation.findFirst({
    where: { id, doctorId: authResult.id },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const [messages, total] = await Promise.all([
    prisma.message.findMany({
      where: { conversationId: id },
      orderBy: { createdAt: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.message.count({ where: { conversationId: id } }),
  ]);

  // Mark patient messages as read
  await prisma.message.updateMany({
    where: {
      conversationId: id,
      role: "PATIENT",
      isRead: false,
    },
    data: { isRead: true },
  });

  return NextResponse.json({
    messages,
    pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
  });
}

/**
 * POST /api/conversations/[id]/messages - Doctor sends a reply.
 * Translates to patient's language and sends via WhatsApp.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authenticateDoctor(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = params;
  const body = await request.json();
  const { content } = body;

  if (!content || typeof content !== "string") {
    return NextResponse.json({ error: "content is required" }, { status: 400 });
  }

  // Get conversation with patient and doctor details
  const conversation = await prisma.conversation.findFirst({
    where: { id, doctorId: authResult.id },
    include: {
      patient: true,
      doctor: {
        include: { settings: true },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { patient, doctor } = conversation;

  if (!doctor.whatsappPhoneId || !doctor.whatsappToken) {
    return NextResponse.json(
      { error: "WhatsApp not configured for this doctor" },
      { status: 400 }
    );
  }

  const waConfig = {
    phoneNumberId: doctor.whatsappPhoneId,
    accessToken: doctor.whatsappToken,
  };

  // Translate doctor's English reply to patient's language
  let translatedContent = content;
  if (patient.language !== "en" && patient.language !== "unknown") {
    try {
      const result = await translate(content, "en", patient.language);
      translatedContent = result.translatedText;
    } catch (error) {
      console.error("Translation error for doctor reply:", error);
      // Send in English as fallback
    }
  }

  // Send text via WhatsApp
  await sendTextMessage(waConfig, patient.phone, translatedContent);

  // Optionally send audio
  if (doctor.settings?.enableVoiceReply && patient.language !== "en") {
    try {
      const { audioBase64 } = await textToSpeech(translatedContent, patient.language);
      if (audioBase64) {
        const audioBuffer = Buffer.from(audioBase64, "base64");
        await sendAudioByUpload(waConfig, patient.phone, audioBuffer);
      }
    } catch (error) {
      console.warn("TTS for doctor reply failed:", error);
    }
  }

  // Store the message
  const message = await prisma.message.create({
    data: {
      conversationId: id,
      role: "DOCTOR",
      type: "TEXT",
      contentOriginal: translatedContent,
      contentEnglish: content,
      languageCode: patient.language,
    },
  });

  // Update conversation status back to ACTIVE
  await prisma.conversation.update({
    where: { id },
    data: { status: "ACTIVE" },
  });

  // Audit log
  await logAudit(authResult.id, "DOCTOR_REPLY", `conversation:${id}`, {
    patientId: patient.id,
    languageCode: patient.language,
  });

  return NextResponse.json({ message });
}
