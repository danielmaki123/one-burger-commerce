import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaPaymentRepository } from "@/modules/orders/adapters/prisma-payment-repository";
import { listReconciliationPayments } from "@/modules/orders/features/reconciliation/list-reconciliation-payments";
import type { LocationRecord } from "@/modules/locations/domain/location.types";
import { resolveCashLocationId } from "@/modules/pos/domain/cash-locations";
import { businessDate, businessDayRange } from "@/shared/lib/business-days";

/**
 * Tarea 10 del brief (2026-09-17) — el cableado de la **conciliación** (11.1/11.2).
 *
 * Resuelve el día **del negocio** (el del servidor en UTC partiría el día de caja en dos), el local dentro
 * del alcance y la ventana completa de ese día, y llama al caso de uso. Sin local válido devuelve `null`:
 * la pantalla ya sabe mostrar «no hay sucursales a tu cargo» y no hace falta un error.
 *
 * Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas.
 */
export async function reconciliationForRoute(input: {
  locations: LocationRecord[];
  requestedLocationId: string | null;
  requestedDate: string | null;
}) {
  const settings = await loadBusinessSettings({
    repository: new PrismaBusinessSettingsRepository(),
  });
  const date = input.requestedDate ?? businessDate(new Date(), settings.timezone);
  const locationId = resolveCashLocationId(input.locations, input.requestedLocationId);

  if (!locationId) return { data: null };

  const range = businessDayRange(date, settings.timezone);
  const result = await listReconciliationPayments(
    {
      locationId,
      from: range.from,
      to: range.to,
      baseCurrencyCode: settings.currencyCode,
    },
    { paymentRepository: new PrismaPaymentRepository() },
  );

  return { data: { date, locationId, ...result.data } };
}
