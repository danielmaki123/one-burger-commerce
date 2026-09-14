import { redirect } from "next/navigation";

import { canUsePOS } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaLocationRepository } from "@/modules/locations/adapters/prisma-location-repository";
import { listPublicLocations } from "@/modules/locations/features/list-public-locations/list-public-locations";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";

import PosClient from "./pos-client";

/**
 * TASK-302 — el punto de venta.
 *
 * El permiso se resuelve en el servidor (`canUsePOS`: dueño, gerente y cajero; cocina no) y el
 * alcance por sucursal reusa la regla que ya existe (A): quien tiene sucursales asignadas solo ve
 * las suyas, el dueño ve todas. El catálogo llega después por la API del POS, que aplica el mismo
 * alcance: la pantalla no es la que decide.
 */
export default async function AdminPosPage() {
  const session = await requireAdminSession();

  if (!canUsePOS(session.user.role)) {
    redirect("/admin/orders");
  }

  const scope = resolveOrderLocationScope({
    role: session.user.role,
    assignedLocationIds: session.user.locationIds,
  });

  const { data } = await listPublicLocations({ repository: new PrismaLocationRepository() });
  const locations = (
    scope.kind === "all" ? data : data.filter((location) => scope.locationIds.includes(location.id))
  ).map((location) => ({ id: location.id, name: location.name }));

  return <PosClient locations={locations} />;
}
