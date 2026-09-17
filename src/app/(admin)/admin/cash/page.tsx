import { redirect } from "next/navigation";

import { requireCashScope } from "@/app/api/admin/cash/cash-route-helpers";
import { canUsePOS, canViewCashHistory } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { listCashLocations } from "@/modules/pos/domain/cash-locations";

import { AdminPageHeader } from "../_components/admin-operational-ui";
import CashClient from "./cash-client";
import CashDrawerPanel from "./cash-drawer-panel";
import DayClosePanel from "./day-close-panel";

/**
 * Bloque 1.3 + tarea 1 del brief (2026-09-17) — la **caja**, separada del POS.
 *
 * La pantalla tiene dos mitades y cada una tiene su permiso:
 *
 * - **Abrir o cerrar la caja** (el trabajo del mostrador): quien cobra, o sea `canUsePOS` — el cajero
 *   incluido. Antes esto vivía plegado dentro del POS y el pedido fue sacarlo: «POS limpio, Caja aparte».
 * - **Auditar** (historial de cierres, día consolidado, comparación por sucursal): `canViewCashHistory`.
 *   El cajero no audita su propio turno, así que esa mitad no la ve.
 *
 * El alcance por sucursal se resuelve con la puerta que corresponde a cada mitad: la de control pide
 * `canManageCash` (dueño o manager) y la del mostrador respeta las sucursales asignadas del cajero.
 */
export default async function AdminCashPage() {
  const session = await requireAdminSession();
  const canOperate = canUsePOS(session.user.role);
  const canAudit = canViewCashHistory(session.user.role);

  if (!canOperate && !canAudit) {
    redirect("/admin/orders");
  }

  const locations = canAudit
    ? await requireCashScope({
        role: session.user.role,
        assignedLocationIds: session.user.locationIds,
      })
    : listCashLocations(
        await createProductionPosLocationDependencies().repository.listLocations(),
        resolveOrderLocationScope({
          role: session.user.role,
          assignedLocationIds: session.user.locationIds,
        }),
      );

  if (locations.length === 0) {
    redirect("/admin/orders");
  }

  const options = locations.map(({ id, name }) => ({ id, name }));

  return (
    <div className="space-y-4">
      <AdminPageHeader
        label="Control"
        title="Caja del día"
        description={
          canAudit
            ? "Abrí y cerrá la caja del local, y auditá lo que quedó: cierres, arqueo y movimientos."
            : "Abrí y cerrá la caja del local con el conteo de billetes."
        }
      />

      {canOperate ? <CashDrawerPanel locations={options} /> : null}

      {canAudit ? (
        <>
          <DayClosePanel locations={options} />
          <CashClient locations={options} />
        </>
      ) : null}
    </div>
  );
}
