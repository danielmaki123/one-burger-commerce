import type { AuditAction } from "@/modules/audit/domain/audit-actions";

/** Lo que se guarda por cada acción sensible (Bloque 13.1 del roadmap del POS, Fase 2). */
export type RecordAuditLogInput = {
  action: AuditAction;
  /** Quién la hizo. Es texto **sin** relación con `AdminUser`: el asiento sobrevive a que la cuenta se borre. */
  actorUserId: string;
  /** Sobre qué se hizo (`Shift`, `Refund`, `Order`, `BusinessSettings`). */
  targetType: string;
  targetId: string;
  /** El detalle que hace falta para entenderla sin abrir otra pantalla. */
  detail?: Record<string, unknown>;
};

export interface AuditLogRepository {
  record(input: RecordAuditLogInput): Promise<unknown>;
}
