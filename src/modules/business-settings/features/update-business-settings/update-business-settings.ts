import { mergeBusinessHours } from "@/modules/business-settings/domain/business-hours";
import { createDefaultBusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings-defaults";
import { BusinessSettingsError } from "@/modules/business-settings/domain/business-settings-errors";
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

  // El rango de preparación no puede terminar antes de empezar. El esquema ya
  // valida los dos números cuando vienen juntos en el payload; acá se completa el
  // caso de mandar uno solo, comparando contra lo guardado (T5).
  const nextLead = patch.pickupLeadMinutes ?? current.pickupLeadMinutes;
  const nextMax =
    patch.pickupMaxMinutes !== undefined ? patch.pickupMaxMinutes : current.pickupMaxMinutes;

  if (nextMax !== null && nextMax < nextLead) {
    throw new BusinessSettingsError(
      422,
      "VALIDATION_ERROR",
      "La configuración del negocio tiene errores de validación",
      { pickupMaxMinutes: "Tiene que ser mayor o igual que los minutos de preparación" },
    );
  }

  const { businessHours, ...rest } = patch;

  const next: BusinessSettingsPatch = {
    ...rest,
    ...(businessHours !== undefined
      ? { businessHours: mergeBusinessHours(current.businessHours, businessHours) }
      : {}),
  };

  return repository.update(next, { updatedByUserId });
}
