import type { AdminRole } from "@/modules/auth/domain/admin-role";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { readProductionMoney } from "@/modules/money/adapters/production-money-context";
import { PrismaOrderRepository } from "@/modules/orders/adapters/prisma-order-repository";
import {
  resolveOrderLocationScope,
  type OrderLocationScope,
} from "@/modules/orders/domain/order-visibility";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **el contexto del listado**: alcance, zona horaria y moneda base.
 *
 * Vive acá y no en el `route.ts` porque el handler tiene un tope de 50 líneas y porque esto es
 * composición: arma las dependencias y traduce la sesión a lo que el caso de uso necesita.
 *
 * Tres datos, y cada uno tiene su dueño:
 *
 * - **el alcance** lo resuelve `orders` (`resolveOrderLocationScope`), no la ruta;
 * - **la zona horaria** sale de la configuración del negocio: «hoy» es el día del local, no el del
 *   servidor ni el del navegador (`A-63`);
 * - **la moneda base** sale de `money` (`readProductionMoney`, `A-83`), no de la configuración de marca.
 *
 * `locationScope` viaja en `meta` para que la pantalla dibuje su filtro de sucursal sin reimplementar la
 * regla: `null` = todas.
 */
export async function loadOrderListContext(user: {
  role: AdminRole;
  locationIds?: readonly string[] | null;
}): Promise<{
  scope: OrderLocationScope;
  locationScope: string[] | null;
  timeZone: string;
  baseCurrencyCode: string;
}> {
  const scope = resolveOrderLocationScope({
    role: user.role,
    assignedLocationIds: user.locationIds,
  });

  const [money, settings] = await Promise.all([
    readProductionMoney(),
    loadBusinessSettings({ repository: new PrismaBusinessSettingsRepository() }),
  ]);

  return {
    scope,
    locationScope: scope.kind === "restricted" ? scope.locationIds : null,
    timeZone: settings.timezone,
    baseCurrencyCode: money.context.baseCurrencyCode,
  };
}

/**
 * El alcance y la zona, para las pantallas que no necesitan la moneda base (la hoja de la factura). Es la
 * **misma** resolución que la del listado: si se separaran, el filtro de sucursal de una pantalla y el de
 * otra podrían dejar de coincidir.
 */
export async function loadOrderScopeContext(user: {
  role: AdminRole;
  locationIds?: readonly string[] | null;
}): Promise<{ scope: OrderLocationScope; timeZone: string }> {
  const { scope, timeZone } = await loadOrderListContext(user);

  return { scope, timeZone };
}

/** Los adaptadores del listado, en un solo lugar. */
export function listAdminOrderRepositories() {
  return {
    repository: new PrismaOrderRepository(),
    locationRepository: new PrismaLocationRepository(),
  };
}
