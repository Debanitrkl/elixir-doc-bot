import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authenticateDoctor } from "@/lib/auth/middleware";

/**
 * GET /api/conversations - List conversations for a doctor.
 * GET /api/conversations/[id] - Get a single conversation.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authenticateDoctor(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = params;

  // If id is "list", return paginated list
  if (id === "list") {
    const searchParams = request.nextUrl.searchParams;
    const page = parseInt(searchParams.get("page") || "1", 10);
    const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
    const status = searchParams.get("status");

    const where = {
      doctorId: authResult.id,
      ...(status && { status: status as "ACTIVE" | "WAITING_DOCTOR" | "CLOSED" | "ARCHIVED" }),
    };

    const [conversations, total] = await Promise.all([
      prisma.conversation.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          patient: {
            select: { id: true, name: true, phone: true, language: true },
          },
          messages: {
            orderBy: { createdAt: "desc" },
            take: 1,
            select: {
              contentEnglish: true,
              role: true,
              createdAt: true,
              isRead: true,
            },
          },
          _count: { select: { messages: true } },
        },
      }),
      prisma.conversation.count({ where }),
    ]);

    // Count unread
    const unreadCounts = await prisma.message.groupBy({
      by: ["conversationId"],
      where: {
        conversationId: { in: conversations.map((c) => c.id) },
        role: "PATIENT",
        isRead: false,
      },
      _count: true,
    });

    const unreadMap = new Map(unreadCounts.map((u) => [u.conversationId, u._count]));

    const result = conversations.map((c) => ({
      ...c,
      unreadCount: unreadMap.get(c.id) || 0,
      lastMessage: c.messages[0] || null,
    }));

    return NextResponse.json({
      conversations: result,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  }

  // Get single conversation
  const conversation = await prisma.conversation.findFirst({
    where: { id, doctorId: authResult.id },
    include: {
      patient: {
        select: { id: true, name: true, phone: true, language: true },
      },
    },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  return NextResponse.json({ conversation });
}

/**
 * PUT /api/conversations/[id] - Update conversation status.
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const authResult = await authenticateDoctor(request);
  if (authResult instanceof NextResponse) return authResult;

  const { id } = params;
  const body = await request.json();
  const { status, subject } = body;

  const conversation = await prisma.conversation.findFirst({
    where: { id, doctorId: authResult.id },
  });

  if (!conversation) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (status) updateData.status = status;
  if (subject !== undefined) updateData.subject = subject;

  const updated = await prisma.conversation.update({
    where: { id },
    data: updateData,
  });

  return NextResponse.json({ conversation: updated });
}
