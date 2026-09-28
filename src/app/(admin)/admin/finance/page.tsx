import { redirect } from "next/navigation";

import { canManageFinanceConfig } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

import { AdminPageHeader } from "../_components/admin-operational-ui";
import FinanceClient from "./finance-client";

/**
 * `TASK-MONEY-PAYMENTS-RUNTIME-001` (`D-016`, `D-018`, `A-80`) — **Finanzas** (`/admin/finance`).
 *
 * La superficie de **configuración financiera** que la SPEC aprobada congeló
 * ([`ops/design/screens/finance.md`](../../../../../../ops/design/screens/finance.md)): tres vistas
 * conmutadas por tabs —*Medios de pago*, *Monedas y tasas* y *Entidades de cobro*— sobre los módulos
 * `money`, `payments` y `banks`.
 *
 * La puerta es del **dueño** (`canManageFinanceConfig`): cambiar la moneda base, una tasa o qué medios se
 * aceptan cambia el número que el sistema espera. Un manager o un cajero que entran por URL directa van a
 * Órdenes, igual que en Config de Caja y Usuarios — y la **ruta** lo vuelve a verificar en el servidor: el
 * redirect es la experiencia, no la frontera.
 *
 * La página **no trae datos**: el cliente los pide a `/api/admin/finance`, que es la ruta que aplica la
 * puerta. Así hay una sola frontera de autorización y ningún dato financiero viaja por props del servidor.
 */
export default async function AdminFinancePage() {
  const session = await requireAdminSession();

  if (!canManageFinanceConfig(session.user.role)) {
    redirect("/admin/orders");
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        label="Control"
        title="Finanzas"
        description="Configuración financiera: cómo entra la plata"
      />

      <FinanceClient />
    </div>
  );
}
