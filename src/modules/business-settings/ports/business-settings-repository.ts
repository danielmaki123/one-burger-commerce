import type {
  BusinessSettingsPatch,
  BusinessSettingsRecord,
} from "@/modules/business-settings/domain/business-settings.types";

export type UpdateBusinessSettingsMeta = {
  /** Quién hizo el cambio, para la auditoría visible en el admin. */
  updatedByUserId?: string | null;
};

export interface BusinessSettingsRepository {
  /** Devuelve `null` solo si la fila todavía no existe (base nueva sin migración aplicada). */
  get(): Promise<BusinessSettingsRecord | null>;
  /**
   * Aplica un parche sobre la fila única y la crea si falta. El parche llega con
   * los horarios ya resueltos: la fusión día por día es del caso de uso.
   */
  update(
    patch: BusinessSettingsPatch,
    meta?: UpdateBusinessSettingsMeta,
  ): Promise<BusinessSettingsRecord>;
}
