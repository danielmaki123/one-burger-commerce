import { describe, expect, it } from "vitest";

import { resolveAdminLanding } from "@/modules/auth/domain/admin-landing";
import { ADMIN_ROLES, type AdminRole } from "@/modules/auth/domain/admin-role";

/**
 * `TASK-ORDERS-RUNTIME-5B` (`A-10`, `D-014`) — **dónde aterriza cada rol**.
 *
 * Antes de esto la decisión vivía **tres veces** y ninguna coincidía del todo: `/admin` redirigía a
 * `/admin/orders` (`(admin)/admin/page.tsx`), el shell calculaba su `homeHref` con un
 * `role === "owner"` a mano (`_components/admin-shell.tsx`) y el login volvía a `/admin`. Ninguna de las
 * tres mandaba a cocina a **su** superficie, así que un `kitchen` aterrizaba en Pedidos —una pantalla
 * que la API le responde 403 y que por `D-014` no le corresponde—.
 *
 * Esta función es la **única** respuesta a esa pregunta. Los tests fijan el destino de los cuatro roles
 * con su literal: si alguien cambia un destino, el test dice cuál.
 */
describe("resolveAdminLanding", () => {
  it("el dueño aterriza en el Resumen", () => {
    expect(resolveAdminLanding(ADMIN_ROLES.owner)).toBe("/admin");
  });

  it("manager y cashier aterrizan en Pedidos", () => {
    // El cajero entra a Pedidos a **localizar el pedido que tiene que cobrar** (D-014): es su primera
    // pantalla, no el POS, porque todavía no eligió qué cobrar.
    expect(resolveAdminLanding(ADMIN_ROLES.manager)).toBe("/admin/orders");
    expect(resolveAdminLanding(ADMIN_ROLES.cashier)).toBe("/admin/orders");
  });

  /**
   * La corrección de `A-10`: cocina **no** aterriza en Pedidos. Su superficie es `/admin/kitchen`, la
   * única que puede operar (`canOperateKitchen`) y la única que no proyecta un solo campo de dinero.
   */
  it("cocina aterriza en Cocina, no en Pedidos", () => {
    expect(resolveAdminLanding(ADMIN_ROLES.kitchen)).toBe("/admin/kitchen");
  });

  it("todo rol tiene un destino y es una ruta del panel", () => {
    const roles: AdminRole[] = [
      ADMIN_ROLES.owner,
      ADMIN_ROLES.manager,
      ADMIN_ROLES.cashier,
      ADMIN_ROLES.kitchen,
    ];

    for (const role of roles) {
      expect(resolveAdminLanding(role)).toMatch(/^\/admin(\/|$)/);
    }

    // Los cuatro destinos no son todos el mismo: la función no puede estar devolviendo un literal fijo.
    expect(new Set(roles.map(resolveAdminLanding)).size).toBeGreaterThan(1);
  });
});
