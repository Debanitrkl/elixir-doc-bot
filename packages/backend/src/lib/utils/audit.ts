import { prisma } from "@/lib/db/prisma";

/**
 * Log an audit event for a doctor's activity.
 */
export async function logAudit(
  doctorId: string,
  action: string,
  resource: string,
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    await prisma.auditLog.create({
      data: {
        doctorId,
        action,
        resource,
        metadata: metadata ? JSON.parse(JSON.stringify(metadata)) : undefined,
      },
    });
  } catch (error) {
    // Audit logging should never break the main flow
    console.error("Audit log failed:", error);
  }
}
