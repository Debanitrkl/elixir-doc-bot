import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";
import { hashApiKey } from "@/lib/utils/encryption";
import { createHmac, timingSafeEqual } from "crypto";

export interface AuthenticatedDoctor {
  id: string;
  wpUserId: number;
  wpSiteUrl: string;
  name: string;
  email: string;
  whatsappPhoneId: string | null;
}

/**
 * Authenticate a doctor via API key in Authorization header.
 * Returns the doctor record or a 401 response.
 */
export async function authenticateDoctor(
  request: NextRequest
): Promise<AuthenticatedDoctor | NextResponse> {
  const authHeader = request.headers.get("authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    return NextResponse.json(
      { error: "Missing or invalid Authorization header" },
      { status: 401 }
    );
  }

  const apiKey = authHeader.slice(7);
  const keyHash = hashApiKey(apiKey);

  const doctor = await prisma.doctor.findUnique({
    where: { apiKeyHash: keyHash },
    select: {
      id: true,
      wpUserId: true,
      wpSiteUrl: true,
      name: true,
      email: true,
      whatsappPhoneId: true,
      isActive: true,
    },
  });

  if (!doctor || !doctor.isActive) {
    return NextResponse.json(
      { error: "Invalid or inactive API key" },
      { status: 401 }
    );
  }

  return doctor;
}

/**
 * Verify WhatsApp webhook signature using X-Hub-Signature-256.
 */
export function verifyWhatsAppSignature(
  body: string,
  signature: string | null
): boolean {
  if (!signature) return false;

  const appSecret = process.env.WHATSAPP_APP_SECRET;
  if (!appSecret) throw new Error("WHATSAPP_APP_SECRET not set");

  const expectedSig =
    "sha256=" +
    createHmac("sha256", appSecret).update(body).digest("hex");

  try {
    return timingSafeEqual(
      Buffer.from(signature),
      Buffer.from(expectedSig)
    );
  } catch {
    return false;
  }
}

/**
 * Verify master secret for doctor registration.
 */
export function verifyMasterSecret(secret: string): boolean {
  const masterSecret = process.env.DOCBOT_MASTER_SECRET;
  if (!masterSecret) throw new Error("DOCBOT_MASTER_SECRET not set");

  try {
    return timingSafeEqual(
      Buffer.from(secret),
      Buffer.from(masterSecret)
    );
  } catch {
    return false;
  }
}

/**
 * Rate limiting check. Returns true if rate limit exceeded.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<boolean> {
  const now = new Date();
  const windowStart = new Date(now.getTime() - windowMs);

  const record = await prisma.rateLimit.findUnique({ where: { id: key } });

  if (!record || record.windowStart < windowStart) {
    await prisma.rateLimit.upsert({
      where: { id: key },
      create: { id: key, count: 1, windowStart: now },
      update: { count: 1, windowStart: now },
    });
    return false;
  }

  if (record.count >= maxRequests) {
    return true;
  }

  await prisma.rateLimit.update({
    where: { id: key },
    data: { count: { increment: 1 } },
  });

  return false;
}
