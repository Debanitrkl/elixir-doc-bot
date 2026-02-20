import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authenticateDoctor } from "@/lib/auth/middleware";

/**
 * GET /api/stats - Dashboard statistics for a doctor.
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateDoctor(request);
  if (authResult instanceof NextResponse) return authResult;

  const doctorId = authResult.id;

  const [
    totalPatients,
    activeConversations,
    waitingConversations,
    totalMessages,
    todayMessages,
    recentConversations,
    languageDistribution,
  ] = await Promise.all([
    // Total patients
    prisma.patient.count({ where: { doctorId } }),

    // Active conversations
    prisma.conversation.count({
      where: { doctorId, status: "ACTIVE" },
    }),

    // Conversations waiting for doctor
    prisma.conversation.count({
      where: { doctorId, status: "WAITING_DOCTOR" },
    }),

    // Total messages
    prisma.message.count({
      where: { conversation: { doctorId } },
    }),

    // Today's messages
    prisma.message.count({
      where: {
        conversation: { doctorId },
        createdAt: {
          gte: new Date(new Date().setHours(0, 0, 0, 0)),
        },
      },
    }),

    // Recent conversations with last message
    prisma.conversation.findMany({
      where: { doctorId },
      orderBy: { updatedAt: "desc" },
      take: 5,
      include: {
        patient: {
          select: { name: true, phone: true, language: true },
        },
        messages: {
          orderBy: { createdAt: "desc" },
          take: 1,
          select: { contentEnglish: true, role: true, createdAt: true },
        },
      },
    }),

    // Language distribution
    prisma.patient.groupBy({
      by: ["language"],
      where: { doctorId },
      _count: true,
      orderBy: { _count: { language: "desc" } },
    }),
  ]);

  // Compute unread count
  const unreadCount = await prisma.message.count({
    where: {
      conversation: { doctorId },
      role: "PATIENT",
      isRead: false,
    },
  });

  return NextResponse.json({
    stats: {
      totalPatients,
      activeConversations,
      waitingConversations,
      totalMessages,
      todayMessages,
      unreadCount,
    },
    recentConversations: recentConversations.map((c) => ({
      id: c.id,
      status: c.status,
      patient: c.patient,
      lastMessage: c.messages[0] || null,
      updatedAt: c.updatedAt,
    })),
    languageDistribution: languageDistribution.map((l) => ({
      language: l.language,
      count: l._count,
    })),
  });
}
