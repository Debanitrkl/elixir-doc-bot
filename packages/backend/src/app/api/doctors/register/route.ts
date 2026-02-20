import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { generateApiKey, hashApiKey } from "@/lib/utils/encryption";
import { verifyMasterSecret } from "@/lib/auth/middleware";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { masterSecret, wpUserId, wpSiteUrl, name, email, whatsappPhoneId, whatsappToken } = body;

    if (!masterSecret || !wpUserId || !wpSiteUrl || !name || !email) {
      return NextResponse.json(
        { error: "Missing required fields: masterSecret, wpUserId, wpSiteUrl, name, email" },
        { status: 400 }
      );
    }

    if (!verifyMasterSecret(masterSecret)) {
      return NextResponse.json({ error: "Invalid master secret" }, { status: 403 });
    }

    // Check if doctor already registered from this WP site
    const existing = await prisma.doctor.findFirst({
      where: { wpUserId, wpSiteUrl },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Doctor already registered from this WordPress site" },
        { status: 409 }
      );
    }

    const apiKey = generateApiKey();
    const apiKeyHash = hashApiKey(apiKey);

    const doctor = await prisma.doctor.create({
      data: {
        wpUserId,
        wpSiteUrl,
        name,
        email,
        apiKeyHash,
        whatsappPhoneId: whatsappPhoneId || null,
        whatsappToken: whatsappToken || null,
        settings: {
          create: {},
        },
      },
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
      },
    });

    return NextResponse.json({
      ...doctor,
      apiKey, // Only returned once at registration
      message: "Store this API key securely. It will not be shown again.",
    });
  } catch (error) {
    console.error("Doctor registration error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
