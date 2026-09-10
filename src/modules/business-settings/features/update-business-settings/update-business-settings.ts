import { mergeBusinessHours } from "@/modules/business-settings/domain/business-hours";
import { createDefaultBusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings-defaults";
import { parseBusinessSettingsPatch } from "@/modules/business-settings/domain/business-settings.schema";
import type {
  BusinessSettingsPatch,
  BusinessSettingsRecord,
} from "@/modules/business-settings/domain/business-settings.types";
import type { BusinessSettingsRepository } from "@/modules/business-settings/ports/business-settings-repository";

type UpdateBusinessSettingsDependencies = {
  repository: BusinessSettingsRepository;
  /** Id del admin que guarda: queda en la auditoría de la fila. */
  updatedByUserId?: string | null;
};

/**
 * Guarda la configuración del negocio.
 *
 * Recibe el payload crudo a propósito: la validación vive en el esquema
 * compartido (`business-settings.schema.ts`) y es la única puerta de entrada,
 * tanto para el API route como para el formulario del admin.
 */
export async function updateBusinessSettings(
  input: unknown,
  { repository, updatedByUserId = null }: UpdateBusinessSettingsDependencies,
): Promise<BusinessSettingsRecord> {
  const patch = parseBusinessSettingsPatch(input);
  const current = (await repository.get()) ?? createDefaultBusinessSettingsRecord();

  const { businessHours, ...rest } = patch;

  const next: BusinessSettingsPatch = {
    ...rest,
    ...(businessHours !== undefined
      ? { businessHours: mergeBusinessHours(current.businessHours, businessHours) }
      : {}),
  };

  return repository.update(next, { updatedByUserId });
}
