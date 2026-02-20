import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { authenticateDoctor, AuthenticatedDoctor } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  const authResult = await authenticateDoctor(request);
  if (authResult instanceof NextResponse) return authResult;
  const doctor = authResult as AuthenticatedDoctor;

  const settings = await prisma.doctorSettings.findUnique({
    where: { doctorId: doctor.id },
  });

  if (!settings) {
    return NextResponse.json({ error: "Settings not found" }, { status: 404 });
  }

  return NextResponse.json({
    doctor: {
      id: doctor.id,
      name: doctor.name,
      email: doctor.email,
      whatsappPhoneId: doctor.whatsappPhoneId,
    },
    settings,
  });
}

export async function PUT(request: NextRequest) {
  const authResult = await authenticateDoctor(request);
  if (authResult instanceof NextResponse) return authResult;
  const doctor = authResult as AuthenticatedDoctor;

  try {
    const body = await request.json();

    // Allowed settings fields
    const allowedFields = [
      "specialization",
      "qualifications",
      "systemPrompt",
      "greetingMessage",
      "workingHoursStart",
      "workingHoursEnd",
      "workingHoursTimezone",
      "enableVoiceReply",
      "enableAutoReply",
      "gptModel",
      "defaultLanguage",
      "offHoursMessage",
    ];

    const updateData: Record<string, unknown> = {};
    for (const field of allowedFields) {
      if (body[field] !== undefined) {
        updateData[field] = body[field];
      }
    }

    // Also allow updating doctor-level WhatsApp config
    if (body.whatsappPhoneId !== undefined || body.whatsappToken !== undefined) {
      await prisma.doctor.update({
        where: { id: doctor.id },
        data: {
          ...(body.whatsappPhoneId !== undefined && { whatsappPhoneId: body.whatsappPhoneId }),
          ...(body.whatsappToken !== undefined && { whatsappToken: body.whatsappToken }),
        },
      });
    }

    const settings = await prisma.doctorSettings.update({
      where: { doctorId: doctor.id },
      data: updateData,
    });

    return NextResponse.json({ settings });
  } catch (error) {
    console.error("Settings update error:", error);
    return NextResponse.json(
      { error: "Failed to update settings" },
      { status: 500 }
    );
  }
}
