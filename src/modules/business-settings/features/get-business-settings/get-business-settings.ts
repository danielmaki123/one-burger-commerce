import { createDefaultBusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings-defaults";
import { mergeBusinessHours } from "@/modules/business-settings/domain/business-hours";
import type { BusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings.types";
import type { BusinessSettingsRepository } from "@/modules/business-settings/ports/business-settings-repository";

type GetBusinessSettingsDependencies = {
  repository: BusinessSettingsRepository;
};

/**
 * Lee la configuración del negocio.
 *
 * Si la fila todavía no existe (base recién migrada sin seed) devuelve los
 * defaults en vez de romper el sitio público.
 */
export async function getBusinessSettings({
  repository,
}: GetBusinessSettingsDependencies): Promise<BusinessSettingsRecord> {
  const settings = await repository.get();

  if (!settings) {
    return createDefaultBusinessSettingsRecord();
  }

  return {
    ...settings,
    // Nunca se comparte la referencia de los horarios guardados.
    businessHours: mergeBusinessHours(null, settings.businessHours),
  };
}
