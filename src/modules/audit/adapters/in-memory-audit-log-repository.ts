import type { AuditAction } from "@/modules/audit/domain/audit-actions";
import type {
  AuditLogRepository,
  RecordAuditLogInput,
} from "@/modules/audit/ports/audit-log-repository";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` — el doble en memoria del log de acciones sensibles.
 *
 * Los adaptadores en memoria de `money` escriben su asiento con este doble (regla del repo: el doble
 * implementa el puerto completo), y los tests leen `entries()` para comprobar **qué** se firmó y **cuándo
 * en la unidad**: es lo que permite probar que el asiento se escribe junto con la fila y no después.
 */
export class InMemoryAuditLogRepository implements AuditLogRepository {
  private entries: RecordAuditLogInput[] = [];

  async record(input: RecordAuditLogInput): Promise<unknown> {
    const entry: RecordAuditLogInput = {
      action: input.action,
      actorUserId: input.actorUserId,
      targetType: input.targetType,
      targetId: input.targetId,
      ...(input.detail ? { detail: input.detail } : {}),
    };

    this.entries.push(entry);

    return { id: `log_${this.entries.length}`, createdAt: new Date().toISOString(), ...entry };
  }

  /** Los asientos escritos, del más viejo al más nuevo. */
  list(): RecordAuditLogInput[] {
    return this.entries.map((entry) => ({ ...entry }));
  }

  /** Los asientos de una acción. */
  listByAction(action: AuditAction): RecordAuditLogInput[] {
    return this.list().filter((entry) => entry.action === action);
  }
}
