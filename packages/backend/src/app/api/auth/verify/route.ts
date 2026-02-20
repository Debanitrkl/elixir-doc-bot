import { NextRequest, NextResponse } from "next/server";
import { authenticateDoctor } from "@/lib/auth/middleware";

export async function GET(request: NextRequest) {
  const authResult = await authenticateDoctor(request);
  if (authResult instanceof NextResponse) return authResult;

  return NextResponse.json({
    valid: true,
    doctor: {
      id: authResult.id,
      name: authResult.name,
      email: authResult.email,
    },
  });
}
