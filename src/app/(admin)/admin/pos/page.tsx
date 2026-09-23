import { redirect } from "next/navigation";

import { canDiscountPosSale, canUsePOS } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { PrismaCashConfigRepository } from "@/modules/cash-config/adapters/prisma-cash-config-repository";
import { getCashTerminals } from "@/modules/cash-config/features/get-cash-terminals/get-cash-terminals";
import { pickPosLocations } from "@/modules/pos/domain/pos-locations";

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
 */
export default async function AdminPosPage() {
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

  return (
    <PosClient
      locations={locations}
      canDiscount={canDiscountPosSale(session.user.role)}
      cashTerminalsByLocation={cashTerminalsByLocation}
    />
  );
}
