import { redirect } from "next/navigation";

import { canUsePOS } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
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

  return <PosClient locations={locations} />;
}
