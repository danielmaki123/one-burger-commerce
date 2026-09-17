import { redirect } from "next/navigation";

import { requireCashScope } from "@/app/api/admin/cash/cash-route-helpers";
import { canViewCashHistory } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

import { AdminPageHeader } from "../_components/admin-operational-ui";
import CashClient from "./cash-client";
import DayClosePanel from "./day-close-panel";

/**
 * Bloque 1.3 del roadmap del POS (Fase 2) — la caja del día.
 *
 * Es la pantalla de **control**, no la del mostrador: la caja se abre y se cierra en `/admin/pos`, y
 * acá se audita lo que quedó. El permiso es `canViewCashHistory` (dueño y manager): el cajero no revisa su
 * propio turno.
 */
export default async function AdminCashPage() {
  const session = await requireAdminSession();

  if (!canViewCashHistory(session.user.role)) {
    redirect("/admin/orders");
  }

  const locations = await requireCashScope({
    role: session.user.role,
    assignedLocationIds: session.user.locationIds,
  });

  return (
    <div className="space-y-4">
      <AdminPageHeader
        label="Control"
        title="Caja del día"
        description="Los turnos cerrados, con lo contado, lo esperado y la diferencia. La caja se abre y se cierra desde el POS."
      />

      {/* Bloque 11.5/11.6 del roadmap del POS (Fase 2): el día consolidado de todas las sucursales del
          alcance, arriba del historial por sucursal. */}
      <DayClosePanel locations={locations.map(({ id, name }) => ({ id, name }))} />

      <CashClient locations={locations.map(({ id, name }) => ({ id, name }))} />
    </div>
  );
}
