import type {
  CashConfigPatch,
  CashDenominationRecord,
  LocationCashConfigRecord,
  PosTerminalRecord,
} from "@/modules/cash-config/domain/cash-config.types";

export type UpdateCashConfigMeta = {
  /** Quién guardó: queda en la auditoría de la fila del local. */
  updatedByUserId?: string | null;
};

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — el puerto de la configuración de caja.
 *
 * Dos cosas con dueños distintos, en el mismo puerto para que un solo módulo sea el dueño de la config:
 *
 * - **Por sucursal**: `getLocationConfig` / `saveLocationConfig` (monedas y arqueo ciego).
 * - **Del negocio**: `listDenominations` / `replaceDenominations` (los billetes son los mismos en los
 *   tres locales).
 *
 * `replaceDenominations` recibe la lista **completa** porque es lo que hace el formulario: se edita la
 * grilla y se guarda entera. El adaptador se encarga de que eso no borre la historia —desactivar una fila
 * la deja en la tabla— y de que las denominaciones afuera de la lista se **desactiven**, no se borren:
 * un cierre viejo sigue diciendo con qué billetes se contó.
 */
export interface CashConfigRepository {
  /** `null` = la sucursal todavía no tiene fila (nace con los valores de fábrica). */
  getLocationConfig(locationId: string): Promise<LocationCashConfigRecord | null>;
  saveLocationConfig(
    locationId: string,
    patch: Pick<CashConfigPatch, "usdEnabled" | "blindCount">,
    meta?: UpdateCashConfigMeta,
  ): Promise<LocationCashConfigRecord>;
  /** Todas las filas, activas e inactivas, ordenadas por moneda y valor. */
  listDenominations(): Promise<CashDenominationRecord[]>;
  replaceDenominations(
    rows: CashDenominationRecord[],
    meta?: UpdateCashConfigMeta,
  ): Promise<CashDenominationRecord[]>;
  /**
   * Fase 6 del rediseño de Caja (2026-09-23) — las **terminales del POS** de las sucursales pedidas
   * (activas e inactivas: la pantalla muestra las apagadas para poder volver a prenderlas).
   */
  listPosTerminals(locationIds: readonly string[]): Promise<PosTerminalRecord[]>;
  /**
   * Guarda las terminales **de una sucursal** tal como vienen: sube lo que está, apaga lo que falta y
   * devuelve lo que quedó. No borra: un turno viejo referencia su terminal y el `onDelete: Restrict` de la
   * base lo exige.
   */
  replacePosTerminals(
    locationId: string,
    rows: readonly PosTerminalRecord[],
  ): Promise<PosTerminalRecord[]>;
}
