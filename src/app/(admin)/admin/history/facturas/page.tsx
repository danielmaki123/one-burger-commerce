import { redirect } from "next/navigation";

import { canViewHistory } from "@/modules/auth/domain/admin-permissions";
import { requireAdminSession } from "@/modules/auth/features/require-admin-session/require-admin-session";

import { FacturasClient } from "./facturas-client";

export const dynamic = "force-dynamic";

/**
 * Punto 2 del roadmap (2026-09-18) — **Historial › Facturas**.
 *
 * Mismo permiso que los cierres (`canViewHistory`: owner y manager) y una diferencia que se resuelve acá:
 * el botón **Anular** es del **dueño**. Se pasa como prop para que el manager ni siquiera vea el control,
 * y la API lo vuelve a comprobar (403) — la pantalla no es la que autoriza.
 */
export default async function AdminHistoryFacturasPage() {
  const session = await requireAdminSession();

  if (!canViewHistory(session.user.role)) {
    redirect("/admin/orders");
  }

  return <FacturasClient canVoid={session.user.role === "owner"} />;
}
