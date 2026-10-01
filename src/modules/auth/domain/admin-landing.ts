import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";

/**
 * `TASK-ORDERS-RUNTIME-5B` (`A-10`, `D-014`) — **dónde aterriza cada rol** dentro del panel.
 *
 * La decisión vivía **tres veces** y ninguna coincidía del todo: `/admin` redirigía a `/admin/orders`
 * (`(admin)/admin/page.tsx`), el shell calculaba su `homeHref` con un `role === "owner"` a mano
 * (`_components/admin-shell.tsx:120`) y el login volvía a `/admin`. Ninguna de las tres mandaba a cocina a
 * **su** superficie, así que un `kitchen` aterrizaba en Pedidos: una pantalla que la API le responde 403 y
 * que por `D-014` no le corresponde.
 *
 * Esta función es la **única** respuesta a esa pregunta, y la consumen los tres lugares (el redirect de
 * `/admin`, el `homeHref` del shell y el destino del login). El día que un rol cambie de primera pantalla,
 * se cambia acá y en un solo lugar.
 *
 * Es **dominio** y no composición: no consulta sesión, no toca la base y no depende de Next. El rol entra
 * como dato (igual que en `order-visibility`), así que la regla se puede probar sola.
 */
export const ADMIN_LANDING = {
  /** El overview del negocio: sólo el dueño (`canViewAdminOverview`). */
  dashboard: "/admin",
  orders: "/admin/orders",
  kitchen: "/admin/kitchen",
} as const;

/**
 * La primera pantalla de cada rol.
 *
 * | Rol | Aterriza en | Por qué |
 * |---|---|---|
 * | `owner` | `/admin` | el Resumen es su overview transversal |
 * | `manager` | `/admin/orders` | su trabajo del día empieza localizando y revisando pedidos |
 * | `cashier` | `/admin/orders` | tiene que **encontrar** el pedido que va a cobrar antes de abrirlo en el POS (`D-014`) |
 * | `kitchen` | `/admin/kitchen` | su superficie es Cocina; Pedidos no es suya y le responde 403 |
 */
export function resolveAdminLanding(role: AdminRole): string {
  if (role === ADMIN_ROLES.owner) return ADMIN_LANDING.dashboard;
  if (role === ADMIN_ROLES.kitchen) return ADMIN_LANDING.kitchen;

  return ADMIN_LANDING.orders;
}
