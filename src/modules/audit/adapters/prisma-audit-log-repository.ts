import type { Prisma } from "@prisma/client";
import { getPrismaClient } from "@/infrastructure/database/prisma";
import type { AuditAction } from "@/modules/audit/domain/audit-actions";
import type { AuditLogRepository } from "@/modules/audit/ports/audit-log-repository";

/**
 * Bloque 13.1 del roadmap del POS (Fase 2) — el log de acciones sensibles en Postgres.
 *
 * `action` se guarda como texto y no como enum de la base a propósito: la lista vive en el dominio
 * (`AUDIT_ACTIONS`) y agregar una acción ahí no debería exigir una migración. El costo es que la base
 * no restringe el valor, y por eso la única puerta de escritura es el caso de uso, que valida contra la
 * lista antes de llegar acá.
 *
 * `actorUserId` es texto y **sin** relación con `AdminUser`: el asiento tiene que sobrevivir a que la
 * cuenta se borre (si no, se perdería el rastro de quién hizo qué).
 */
export class PrismaAuditLogRepository implements AuditLogRepository {
  async record(input: {
    action: AuditAction;
    actorUserId: string;
    targetType: string;
    targetId: string;
    detail?: Record<string, unknown>;
  }) {
    const prisma = getPrismaClient();

    return prisma.adminAuditLog.create({
      data: {
        action: input.action,
        actorUserId: input.actorUserId,
        targetType: input.targetType,
        targetId: input.targetId,
        // Prisma pide su propio tipo para `Json`; el detalle es un objeto plano (lo arma el dominio).
        detail: input.detail ? (input.detail as Prisma.InputJsonValue) : undefined,
      },
    });
  }
}
