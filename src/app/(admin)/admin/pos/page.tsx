import { redirect } from "next/navigation";

import { canDiscountPosSale, canUsePOS } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { PrismaCashConfigRepository } from "@/modules/cash-config/adapters/prisma-cash-config-repository";
import { getCashTerminals } from "@/modules/cash-config/features/get-cash-terminals/get-cash-terminals";
import { pickPosLocations } from "@/modules/pos/domain/pos-locations";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";

import { readProductionMoney } from "@/modules/money/adapters/production-money-context";
import PosClient from "./pos-client";

/**
 * TASK-302 — el punto de venta.
 *
 * El permiso se resuelve en el servidor (`canUsePOS`: dueño, gerente y cajero; cocina no) y el
 * alcance por sucursal reusa la regla que ya existe (A): quien tiene sucursales asignadas solo ve
 * las suyas, el dueño ve todas.
 *
 * TASK-308: la lista de locales sale de `pickPosLocations`, la misma regla que usa la navegación para
 * ofrecer la entrada. Un local con el POS apagado no se puede elegir acá —y si no queda ninguno, la
 * pantalla no existe para ese admin: vuelve a órdenes—.
 *
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §24) — la pantalla acepta `?orderId=<id>`: es el puente con el que
 * Pedidos manda un pedido a **cobrar en el POS**. Abre el mismo modo «pedido existente» que los KPI, no un
 * checkout especial. La hora prometida se formatea con la zona del **negocio**, que es la única autoridad
 * para saber de qué día se habla.
 */
export default async function AdminPosPage({
  searchParams,
}: {
  searchParams: Promise<{ orderId?: string }>;
}) {
  const session = await requireAdminSession();

  if (!canUsePOS(session.user.role)) {
    redirect("/admin/orders");
  }

  const { repository } = createProductionPosLocationDependencies();
  const locations = pickPosLocations(
    await repository.listLocations(),
    resolveOrderLocationScope({
      role: session.user.role,
      assignedLocationIds: session.user.locationIds,
    }),
  ).map((location) => ({
    id: location.id,
    name: location.name,
    // Tarea 3 del brief (2026-09-17): el cierre obligatorio es **por sucursal** (1.7); el POS lo
    // necesita para no dejar cobrar con una caja de otro día.
    requireShiftClose: location.requireShiftClose,
  }));

  if (locations.length === 0) {
    redirect("/admin/orders");
  }

  /**
   * Fase 6 del rediseno de Caja (2026-09-23) — las **terminales activas** de cada sucursal. El POS hereda la
   * terminal del turno abierto para firmar cada venta con su caja: con dos POS en el local, sin esto la venta
   * no tendria a que turno entrar.
   */
  const { terminals } = await getCashTerminals(
    { locationIds: locations.map((location) => location.id) },
    { repository: new PrismaCashConfigRepository() },
  );
  const cashTerminalsByLocation: Record<string, { id: string; label: string }[]> = {};
  for (const location of locations) {
    cashTerminalsByLocation[location.id] = terminals
      .filter((terminal) => terminal.locationId === location.id && terminal.isActive)
      .map(({ id, label }) => ({ id, label }));
  }

  // `A-85` — la moneda base vigente y las monedas aceptadas, de `money` (no de la configuración de branding).
  const money = await readProductionMoney();

  /** La zona horaria del negocio, para las horas prometidas del panel operacional. */
  const settings = await loadBusinessSettings({
    repository: new PrismaBusinessSettingsRepository(),
  });
  const { orderId } = await searchParams;

  return (
    <PosClient
      locations={locations}
      /**
       * `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-85`) — **la autoridad monetaria es `money`**.
       *
       * El mostrador recibe la moneda base vigente, sus **tasas por moneda** y las monedas que el negocio
       * acepta: el selector de moneda ofrece esas y no una lista fija con la base y el dólar. Antes las dos
       * salían de la configuración de branding (`settings.currencyCode` + `settings.usdExchangeRate`), que es
       * la autoridad vieja.
       */
      money={money.context}
      acceptedCurrencies={money.currencies.map((currency) => currency.code)}
      canDiscount={canDiscountPosSale(session.user.role)}
      cashTerminalsByLocation={cashTerminalsByLocation}
      initialOrderId={orderId ?? null}
      timeZone={settings.timezone}
    />
  );
}
