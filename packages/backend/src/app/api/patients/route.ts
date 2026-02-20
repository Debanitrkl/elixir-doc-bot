import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authenticateDoctor } from "@/lib/auth/middleware";

/**
 * GET /api/patients - List all patients for a doctor.
 */
export async function GET(request: NextRequest) {
  const authResult = await authenticateDoctor(request);
  if (authResult instanceof NextResponse) return authResult;

  const searchParams = request.nextUrl.searchParams;
  const page = parseInt(searchParams.get("page") || "1", 10);
  const limit = Math.min(parseInt(searchParams.get("limit") || "50", 10), 100);
  const search = searchParams.get("search") || "";

  const where = {
    doctorId: authResult.id,
    ...(search && {
      OR: [
        { name: { contains: search, mode: "insensitive" as const } },
        { phone: { contains: search } },
      ],
    }),
  };

  const [patients, total] = await Promise.all([
    prisma.patient.findMany({
      where,
      orderBy: { lastContactAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
      select: {
        id: true,
        phone: true,
        name: true,
        language: true,
        isBlocked: true,
        firstContactAt: true,
        lastContactAt: true,
        _count: { select: { conversations: true } },
      },
    }),
    prisma.patient.count({ where }),
  ]);

  return NextResponse.json({
    patients,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
}

/**
 * PUT /api/patients - Update a patient (name, isBlocked, language).
 */
export async function PUT(request: NextRequest) {
  const authResult = await authenticateDoctor(request);
  if (authResult instanceof NextResponse) return authResult;

  const body = await request.json();
  const { patientId, name, isBlocked, language } = body;

  if (!patientId) {
    return NextResponse.json({ error: "patientId required" }, { status: 400 });
  }

  // Verify patient belongs to this doctor
  const patient = await prisma.patient.findFirst({
    where: { id: patientId, doctorId: authResult.id },
  });

  if (!patient) {
    return NextResponse.json({ error: "Patient not found" }, { status: 404 });
  }

  const updateData: Record<string, unknown> = {};
  if (name !== undefined) updateData.name = name;
  if (isBlocked !== undefined) updateData.isBlocked = isBlocked;
  if (language !== undefined) updateData.language = language;

  const updated = await prisma.patient.update({
    where: { id: patientId },
    data: updateData,
  });

  return NextResponse.json({ patient: updated });
}
