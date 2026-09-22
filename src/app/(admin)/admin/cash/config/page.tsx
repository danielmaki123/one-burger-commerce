import { redirect } from "next/navigation";

import { canManageCashConfig } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

import { AdminEmptyState, AdminPageHeader } from "../../_components/admin-operational-ui";

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — **Config de Caja** (`/admin/cash/config`).
 *
 * Decisión del owner: el ítem entra al sidebar **desde la Fase 1a** con la pantalla mínima, para no tocar la
 * navegación dos veces. Lo que configura vive en la Fase 2 (monedas activas, denominaciones y arqueo ciego
 * por sucursal) y los bancos en la Fase 3.
 *
 * La puerta es del **dueño** (`canManageCashConfig`): esta pantalla cambia las reglas con las que se firma
 * un arqueo —qué monedas se cuentan, con qué billetes y si el cajero ve el esperado—, y un manager que
 * entra por URL directa va a Órdenes, igual que en Usuarios y Personalización.
 *
 * A propósito **no** dibuja controles: un interruptor decorativo que todavía no guarda nada es exactamente
 * lo que el repo prohíbe. Dice qué va a vivir acá y en qué fase.
 */
export default async function AdminCashConfigPage() {
  const session = await requireAdminSession();

  if (!canManageCashConfig(session.user.role)) {
    redirect("/admin/orders");
  }

  return (
    <div className="space-y-4">
      <AdminPageHeader
        label="Control"
        title="Config de Caja"
        description="Las reglas del arqueo, por sucursal"
      />

      <AdminEmptyState
        title="En construcción"
        description="Acá van a vivir, por sucursal: las monedas que se cuentan (córdobas siempre, dólares si el local los maneja), las denominaciones de billetes y monedas de cada una, y el arqueo ciego del cajero. En la Fase 2; los bancos del cierre, en la Fase 3."
      />
    </div>
  );
}
