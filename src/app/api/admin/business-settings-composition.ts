import { settingsUpdateAudit } from "@/app/api/admin/audit-action-helpers";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { updateBusinessSettings } from "@/modules/business-settings/features/update-business-settings/update-business-settings";

/**
 * Bloque 13.1 del roadmap del POS (Fase 2) — guardar la personalización y dejar su asiento.
 *
 * La personalización cambia lo que ve el cliente (nombre, colores, contacto, horarios): quién la cambió
 * es exactamente lo que se pregunta cuando algo aparece distinto en la web. El asiento va después del
 * cambio y solo si el cambio pasó; un payload rechazado no deja rastro de una acción que no ocurrió.
 *
 * Vive acá y no en el `route.ts` porque ese handler es deuda con techo congelado (76 líneas): no puede
 * crecer, así que la composición se lleva la dependencia y la firma.
 */
export async function updateBusinessSettingsAudited(
  payload: unknown,
  actorUserId: string,
) {
  const settings = await updateBusinessSettings(payload, {
    repository: new PrismaBusinessSettingsRepository(),
    updatedByUserId: actorUserId,
  });

  await settingsUpdateAudit({ actorUserId });

  return settings;
}
