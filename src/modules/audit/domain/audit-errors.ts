/**
 * Bloque 13.1 del roadmap del POS (Fase 2) — el error del log de auditoría.
 *
 * Propio del módulo (como `OrderError` o `PosError`): lo que puede fallar acá es una **acción fuera de
 * la lista** de acciones auditables, y el mapeo a respuesta HTTP lo hace `error-response.ts` por clase.
 * Un `422` con el motivo le dice a quien programa que la acción no está declarada, no que el request
 * esté mal armado.
 */
export class AuditError extends Error {
  constructor(
    public readonly status: 403 | 422,
    public readonly code: "FORBIDDEN" | "VALIDATION_ERROR",
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "AuditError";
  }
}
