import { cache } from "react";

import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { createDefaultBusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings-defaults";
import type { BusinessSettingsRecord } from "@/modules/business-settings/domain/business-settings.types";
import { getBusinessSettings } from "@/modules/business-settings/features/get-business-settings/get-business-settings";
import type { BusinessSettingsRepository } from "@/modules/business-settings/ports/business-settings-repository";

/**
 * Lectura tolerante a fallos.
 *
 * El branding no es dato crítico: si la base no responde preferimos servir el
 * sitio con los defaults antes que devolver un 500 en todas las páginas.
 */
export async function loadBusinessSettings({
  repository,
}: {
  repository: BusinessSettingsRepository;
}): Promise<BusinessSettingsRecord> {
  try {
    return await getBusinessSettings({ repository });
  } catch (error) {
    console.error(
      "[business-settings] no se pudo leer la configuración; se usan los valores por defecto",
      error,
    );
    return createDefaultBusinessSettingsRecord();
  }
}

/**
 * Lectura de la configuración para las superficies públicas.
 *
 * `cache()` de React deduplica dentro del mismo request: el layout, el manifest
 * y la página pueden pedirla y se hace una sola consulta. Las rutas que la usan
 * se declaran `force-dynamic`, así que un cambio guardado en el admin se ve en
 * la siguiente carga sin redeploy.
 */
export const getPublicBusinessSettings = cache(async () =>
  loadBusinessSettings({ repository: new PrismaBusinessSettingsRepository() }),
);
