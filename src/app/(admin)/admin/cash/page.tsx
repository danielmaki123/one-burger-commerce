import Link from "next/link";
import { redirect } from "next/navigation";

import { requireCashScope } from "@/app/api/admin/cash/cash-route-helpers";
import { canUsePOS, canViewCashHistory } from "@/modules/auth/domain/admin-permissions";
import { PrismaBusinessSettingsRepository } from "@/modules/business-settings/adapters/prisma-business-settings-repository";
import { loadBusinessSettings } from "@/modules/business-settings/features/get-public-business-settings/get-public-business-settings";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { listCashLocations } from "@/modules/pos/domain/cash-locations";
import { businessDate } from "@/shared/lib/business-days";

import { AdminPageHeader } from "../_components/admin-operational-ui";
import CashClient from "./cash-client";
import CashView from "./cash-view";
import DayClosePanel from "./day-close-panel";
import ReconciliationPanel from "./reconciliation-panel";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — la **Caja**.
 *
 * La mitad del mostrador es un solo sujeto —el ciclo del turno: apertura → operación → cierre— y sus cuatro
 * estados viven en `CashView` (*cargando*, *error*, *sin turno*, *turno abierto*); acá se resuelve quién
 * entra, con qué sucursales y con qué permisos. La mitad de auditoría (día consolidado, conciliación e
 * historial de cierres) sigue montándose para quien audita: **se muda a sus pantallas en la Fase 1b**.
 *
 * Los dos permisos siguen siendo dos:
 *
 * - **Operar el turno**: quien cobra (`canUsePOS`), el cajero incluido.
 * - **Auditar**: `canViewCashHistory`. De ahí salen el detalle del turno (`canSeeShiftDetail`, A-40) y el
 *   arqueo completo del cierre (`canSeeCloseDetail`).
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

  /**
   * Tarea 10 del brief (2026-09-17) — el día del negocio para la conciliación se resuelve acá (el
   * navegador tiene su propia zona y el día de caja no es el suyo).
   */
  const settings = canAudit
    ? await loadBusinessSettings({ repository: new PrismaBusinessSettingsRepository() })
    : null;

  return (
    <div className="space-y-4">
      <AdminPageHeader
        label="Control"
        title="Caja"
        description={
          canAudit
            ? "Abrí y cerrá la caja del local, y auditá lo que quedó: cierres, arqueo y movimientos."
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

      {canAudit && settings ? (
        <>
          <DayClosePanel locations={options} />
          {/* Tarea 10 del brief: la conciliación de tarjeta y transferencia (11.1/11.2). */}
          <ReconciliationPanel
            locations={options}
            defaultDate={businessDate(new Date(), settings.timezone)}
          />
          <CashClient locations={options} />
        </>
      ) : null}
    </div>
  );
}
