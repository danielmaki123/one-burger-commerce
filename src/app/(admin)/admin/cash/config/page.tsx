import { redirect } from "next/navigation";

import { PrismaBankRepository } from "@/modules/banks/adapters/prisma-bank-repository";
import { getBankCatalog } from "@/modules/banks/features/get-bank-catalog/get-bank-catalog";
import { getCashTerminals } from "@/modules/cash-config/features/get-cash-terminals/get-cash-terminals";
import { canManageCashConfig } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";
import { PrismaCashConfigRepository } from "@/modules/cash-config/adapters/prisma-cash-config-repository";
import { getCashConfig } from "@/modules/cash-config/features/get-cash-config/get-cash-config";
import { resolveOrderLocationScope } from "@/modules/orders/domain/order-visibility";
import { createProductionPosLocationDependencies } from "@/modules/pos/adapters/production-pos-location";
import { listCashLocations } from "@/modules/pos/domain/cash-locations";

import { AdminPageHeader } from "../../_components/admin-operational-ui";
import CashBanksSection from "./cash-banks-section";
import CashTerminalsSection from "./cash-terminals-section";
import CashConfigClient from "./cash-config-client";

/**
 * Fase 2 del rediseño de Caja (2026-09-22) — **Config de Caja** (`/admin/cash/config`), la pantalla real.
 *
 * Reemplaza la pantalla mínima de la Fase 1a (que decía «En construcción» y no tenía controles, a
 * propósito). Ahora configura, por sucursal: si el local cuenta dólares, si el cajero ve el esperado
 * (arqueo ciego) y los billetes de cada moneda.
 *
 * La puerta es del **dueño** (`canManageCashConfig`): esta pantalla cambia las reglas con las que se firma
 * un arqueo, y un manager que entra por URL directa va a Órdenes, igual que en Usuarios y Personalización.
 *
 * Baja como dato la config de la **primera** sucursal del alcance; la pantalla tiene su selector y pide las
 * demás por API (el dueño ve las tres).
 *
 * Fase 3 del rediseño de Caja (2026-09-23) — la sección **Bancos** va acá y no en una pantalla propia: con
 * qué bancos liquida la sucursal es la otra mitad de las reglas del arqueo (contra qué se cuadra el lote
 * de la terminal). Es del negocio con asignación por sucursal, así que baja junto con la config.
 */
export default async function AdminCashConfigPage() {
  const session = await requireAdminSession();

  if (!canManageCashConfig(session.user.role)) {
    redirect("/admin/orders");
  }

  const locations = listCashLocations(
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
  const [initialConfig, bankCatalog, terminals] = await Promise.all([
    getCashConfig({ locationId: options[0].id }, { repository: new PrismaCashConfigRepository() }),
    getBankCatalog({ repository: new PrismaBankRepository() }),
    /* Fase 6 del rediseno de Caja: las terminales del alcance, para editarlas por sucursal. */
    getCashTerminals(
      { locationIds: options.map((location) => location.id) },
      { repository: new PrismaCashConfigRepository() },
    ),
  ]);

  return (
    <div className="space-y-4">
      <AdminPageHeader
        label="Control"
        title="Config de Caja"
        description="Las reglas del arqueo, por sucursal"
      />

      <CashConfigClient locations={options} initialConfig={initialConfig} />

      <CashBanksSection locations={options} initialBanks={bankCatalog.banks} />
      <CashTerminalsSection locations={options} initialTerminals={terminals.terminals} />
    </div>
  );
}
