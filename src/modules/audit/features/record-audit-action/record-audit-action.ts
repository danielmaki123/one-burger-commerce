import { AuditError } from "@/modules/audit/domain/audit-errors";
import { AUDIT_ACTIONS, type AuditAction } from "@/modules/audit/domain/audit-actions";
import type { AuditLogRepository } from "@/modules/audit/ports/audit-log-repository";

export {
  AUDIT_ACTIONS,
  describeAction,
  type AuditAction,
} from "@/modules/audit/domain/audit-actions";

/**
 * Bloque 13.1 del roadmap del POS (Fase 2) — el registro de **acciones sensibles**.
 *
 * Lo que hoy queda en la base es el **estado**, no la intención: se puede leer que un turno se cerró con
 * una diferencia de C$500, pero no quién reabrió la caja, quién aprobó la devolución ni quién movió
 * plata para el proveedor. El arqueo dice cuánto; el log dice **quién**.
 *
 * La acción tiene que estar en la lista cerrada (`AUDIT_ACTIONS`) y el registro es **best-effort**: si
 * el log falla, la acción ya pasó (la plata ya se movió) y tirar el error dejaría al cajero pensando que
 * no se hizo. Se avisa por el logger y se sigue.
 */
export async function recordAuditAction(
  input: {
    action: AuditAction;
    actorUserId: string;
    targetType: string;
    targetId: string;
    detail?: Record<string, unknown>;
  },
  {
    auditLogRepository,
    logger = console,
  }: {
    auditLogRepository: AuditLogRepository;
    logger?: { warn: (message: string) => void };
  },
) {
  if (!AUDIT_ACTIONS.includes(input.action)) {
    throw new AuditError(422, "VALIDATION_ERROR", "Acción desconocida.", {
      action: "Esa acción no está en la lista de acciones auditables.",
    });
  }

  try {
    const entry = await auditLogRepository.record({
      action: input.action,
      actorUserId: input.actorUserId,
      targetType: input.targetType,
      targetId: input.targetId,
      ...(input.detail ? { detail: input.detail } : {}),
    });

    return { data: entry };
  } catch (error) {
    // Best-effort: la acción ya pasó. Se deja rastro en los logs del proceso y se sigue.
    logger.warn(
      `[audit] no se pudo registrar ${input.action} sobre ${input.targetType}:${
        error instanceof Error ? error.message : "error desconocido"
      }`,
    );

    return { data: null };
  }
}
