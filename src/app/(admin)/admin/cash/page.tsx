import Link from "next/link";
import { redirect } from "next/navigation";

import { requireCashScope } from "@/app/api/admin/cash/cash-route-helpers";
import { canUsePOS, canViewCashHistory } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { listCashLocations } from "@/modules/pos/domain/cash-locations";

import { AdminPageHeader } from "../_components/admin-operational-ui";
import CashView from "./cash-view";

/**
 * Fase 1a/1b del rediseño de Caja (2026-09-19) — la **Caja**, con un solo sujeto.
 *
 * La pantalla es el **ciclo del turno**: apertura → operación → cierre. Sus cuatro estados viven en
 * `CashView` (*cargando*, *error*, *sin turno*, *turno abierto*) y acá se resuelve quién entra, con qué
 * sucursales y con qué permisos.
 *
 * La Fase 1b sacó de acá la mitad de auditoría que estaba apilada —el día consolidado, la conciliación de
 * tarjeta y transferencia y el historial de cierres— porque cada una tiene su pantalla: el **reporte del
 * día** (`/admin/cash/report`, con el día y la conciliación) y el **Historial** (`/admin/history/cierres`,
 * con la lista de cierres, el rango de cada turno y el export CSV). Nada se perdió: se mudó.
 *
 * Los dos permisos siguen siendo dos:
 *
 * - **Operar el turno**: quien cobra (`canUsePOS`), el cajero incluido.
 * - **Auditar**: `canViewCashHistory`. De ahí salen el detalle del turno (`canSeeShiftDetail`, A-40) y el
 *   arqueo completo del cierre (`canSeeCloseDetail`).
 *
 * El alcance por sucursal se resuelve con la puerta que corresponde: la de control pide `canManageCash`
 * (dueño o manager) y la del mostrador respeta las sucursales asignadas del cajero.
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
        title="Caja"
        description={
          canAudit
            ? "Abrí y cerrá la caja del local. El día y la conciliación están en el reporte, y los cierres en el Historial."
            : "Abrí y cerrá la caja del local con el conteo de billetes."
        }
        actions={
          canAudit ? (
            <Link
              href="/admin/cash/report"
              className="inline-flex min-h-11 items-center text-st-body font-semibold text-brand-primary underline"
            >
              Reporte del día
            </Link>
          ) : null
        }
      />

      {canOperate ? (
        <CashView
          locations={options}
          canSeeShiftDetail={canAudit}
          canSeeCloseDetail={canAudit}
          actorName={session.user.name}
        />
      ) : null}
    </div>
  );
}
