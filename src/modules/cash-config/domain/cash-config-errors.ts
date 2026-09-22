/**
 * Fase 2 del rediseño de Caja (2026-09-22) — el error de la configuración de caja.
 *
 * Es 422 con detalle por campo, igual que `BusinessSettingsError`: la pantalla de config muestra el
 * mensaje debajo del campo que falló, y la ruta lo mapea sin tocar el mapeador compartido de errores
 * (A-14: ese mapeador ya repite un `if` por módulo y no se hace crecer de gratis).
 */
export class CashConfigError extends Error {
  constructor(
    public readonly status: 422,
    public readonly code: "VALIDATION_ERROR",
    message: string,
    public readonly fields?: Record<string, string>,
  ) {
    super(message);
    this.name = "CashConfigError";
  }
}
