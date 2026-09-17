import { describe, expect, it } from "vitest";

import {
  ADMIN_NAV_GROUPS,
  getAdminDesktopFocusTargetIndex,
  getAdminNavGroups,
  getFocusTrapTargetIndex,
  isAdminNavItemActive,
  shouldRestoreAdminMobileTriggerFocus,
} from "./admin-layout-helpers";

function flattenNav(role?: "owner" | "manager" | "kitchen" | "cashier") {
  return getAdminNavGroups(role).flatMap((group) => group.items);
}

/** TASK-308: la navegación solo ofrece la caja cuando el POS está prendido en algún local. */
function flattenNavWithPos(role: "owner" | "manager" | "cashier" | "kitchen") {
  return getAdminNavGroups(role, { posAvailable: true }).flatMap((group) => group.items);
}

function groupLabels(role: "owner" | "manager" | "cashier" | "kitchen", posAvailable = true) {
  return getAdminNavGroups(role, { posAvailable }).map((group) => group.label);
}

describe("admin layout helpers", () => {
  it("shows Resumen and Usuarios to owner", () => {
    expect(flattenNav("owner")).toContainEqual(
      expect.objectContaining({
        href: "/admin",
        label: "Resumen",
        description: "Operación y rendimiento",
      }),
    );
    expect(flattenNav("owner")).toContainEqual(
      expect.objectContaining({
        href: "/admin/users",
        label: "Usuarios",
      }),
    );
  });

  it.each([undefined, "manager", "kitchen", "cashier"] as const)(
    "does not expose /admin summary before owner access is known (%s)",
    (role) => {
      expect(flattenNav(role)).not.toContainEqual(
        expect.objectContaining({ href: "/admin" }),
      );
    },
  );

  it("lets manager see orders and menu but not users", () => {
    const items = flattenNav("manager");
    expect(items).toContainEqual(expect.objectContaining({ href: "/admin/orders" }));
    expect(items).toContainEqual(expect.objectContaining({ href: "/admin/menu" }));
    expect(items).not.toContainEqual(expect.objectContaining({ href: "/admin/users" }));
  });

  it("solo el owner ve los locales, que son configuración del negocio (T8)", () => {
    expect(flattenNav("owner")).toContainEqual(
      expect.objectContaining({ href: "/admin/locations", label: "Locales" }),
    );
    // Un manager ve pedidos y menú, pero no la configuración del negocio.
    expect(flattenNav("manager")).not.toContainEqual(
      expect.objectContaining({ href: "/admin/locations" }),
    );
    expect(flattenNav("kitchen")).not.toContainEqual(
      expect.objectContaining({ href: "/admin/locations" }),
    );
  });

  /**
   * Decisión del owner (2026-09-17) — **«Alertas» vive en Configuración**, con las otras pantallas del
   * negocio: antes solo se llegaba por un enlace dentro de Personalización. La sección es del owner (la
   * pantalla redirige al resto), así que la entrada tampoco se le ofrece a los otros roles.
   */
  it("«Alertas» está en Configuración y la ve solo el owner", () => {
    expect(flattenNav("owner")).toContainEqual(
      expect.objectContaining({
        href: "/admin/settings/notifications",
        label: "Alertas",
        description: "Notificaciones y avisos",
      }),
    );
    expect(
      ADMIN_NAV_GROUPS.find((group) => group.label === "Configuración")?.items.map((item) => item.href),
    ).toContain("/admin/settings/notifications");

    for (const role of ["manager", "cashier", "kitchen"] as const) {
      expect(groupLabels(role)).not.toContain("Configuración");
      expect(flattenNavWithPos(role)).not.toContainEqual(
        expect.objectContaining({ href: "/admin/settings/notifications" }),
      );
    }
  });

  it("lets kitchen see only orders", () => {
    expect(flattenNav("kitchen").map((item) => item.href)).toEqual(["/admin/orders"]);
  });

  /**
   * Bloque 8 del roadmap del POS (Fase 2) — los cuatro grupos del panel.
   *
   * Antes había dos grupos («Operación» y «Configuración») y la caja se inyectaba dentro de Operación.
   * Ahora el dinero tiene su propio grupo (**Control**), el catálogo el suyo (**Catálogo**) y la
   * configuración del negocio queda en **Configuración**, que es solo del owner.
   */
  it("agrupa la navegación en Operación, Control, Catálogo y Configuración", () => {
    expect(groupLabels("owner")).toEqual([
      "Operación",
      "Control",
      "Catálogo",
      "Configuración",
    ]);
  });

  it("el catálogo no es configuración del negocio: manager ve Catálogo y no Configuración", () => {
    expect(groupLabels("manager")).toEqual(["Operación", "Control", "Catálogo"]);
    expect(flattenNavWithPos("manager")).toContainEqual(
      expect.objectContaining({ href: "/admin/menu", label: "Menú" }),
    );
  });

  it("cocina solo ve Operación: no ve Control, ni Catálogo, ni Configuración", () => {
    expect(groupLabels("kitchen")).toEqual(["Operación"]);
  });

  /**
   * TASK-308 — la caja en la navegación.
   *
   * Dos cosas distintas: que **no** aparezca cuando ningún local del staff tiene el POS prendido (una
   * entrada que lleva a un 403 es peor que no tenerla) y que aparezca para los tres roles que cobran.
   * Cocina no la ve ni con el POS prendido: la navegación no es el lugar donde se descubre el permiso.
   */
  it("no ofrece la caja si ningún local tiene el POS prendido", () => {
    expect(flattenNav("owner")).not.toContainEqual(
      expect.objectContaining({ href: "/admin/pos" }),
    );
    // Sin caja disponible tampoco hay grupo Control: un grupo vacío no se dibuja.
    expect(groupLabels("owner", false)).toEqual(["Operación", "Catálogo", "Configuración"]);
  });

  it.each(["owner", "manager", "cashier"] as const)(
    "ofrece el POS a %s cuando hay un local con el POS prendido",
    (role) => {
      expect(flattenNavWithPos(role)).toContainEqual(
        expect.objectContaining({ href: "/admin/pos", label: "POS" }),
      );
    },
  );

  it("no le ofrece el POS a cocina ni con el POS prendido", () => {
    expect(flattenNavWithPos("kitchen").map((item) => item.href)).toEqual(["/admin/orders"]);
  });

  /**
   * Bloque 8.3 — las rutas nuevas del CONTROL viven en la navegación, no solo por URL directa.
   *
   * `/admin/cash` (historial de cierres) y `/admin/approvals` (aprobaciones pendientes) son del dinero:
   * misma gente que cobra. El dueño y el manager las ven; el cajero opera el mostrador y no administra.
   */
  it.each(["owner", "manager"] as const)(
    "ofrece historial de caja y aprobaciones a %s",
    (role) => {
      const items = flattenNavWithPos(role);
      expect(items).toContainEqual(
        expect.objectContaining({ href: "/admin/cash", label: "Caja del día" }),
      );
      expect(items).toContainEqual(
        expect.objectContaining({ href: "/admin/approvals", label: "Aprobaciones" }),
      );
    },
  );

  /**
   * Tarea 1 del brief (2026-09-17) — la caja se administra desde su propia pantalla, así que el cajero
   * **sí** entra a «Caja del día» (ahí abre y cierra su turno). Lo que no ve es «Aprobaciones», que es de
   * quien administra el dinero, ni la mitad de auditoría de la pantalla (eso se resuelve adentro).
   */
  it("el cajero opera el POS y entra a Caja del día, pero no aprueba devoluciones", () => {
    const items = flattenNavWithPos("cashier");
    expect(items).toContainEqual(expect.objectContaining({ href: "/admin/pos" }));
    expect(items).toContainEqual(
      expect.objectContaining({ href: "/admin/cash", label: "Caja del día" }),
    );
    expect(items).not.toContainEqual(expect.objectContaining({ href: "/admin/approvals" }));
  });

  it("keeps /admin/dashboard active for the Resumen compatibility redirect", () => {
    expect(isAdminNavItemActive("/admin/dashboard", "/admin")).toBe(true);
    expect(isAdminNavItemActive("/admin", "/admin")).toBe(true);
  });

  it("el historial de caja queda activo en la ruta del detalle", () => {
    expect(isAdminNavItemActive("/admin/cash", "/admin/cash")).toBe(true);
    expect(isAdminNavItemActive("/admin/cash/history/shift-1", "/admin/cash")).toBe(true);
  });

  it.each([
    [{ focusableCount: 3, currentIndex: 2, shiftKey: false }, 0],
    [{ focusableCount: 3, currentIndex: 0, shiftKey: true }, 2],
    [{ focusableCount: 3, currentIndex: -1, shiftKey: false }, 0],
    [{ focusableCount: 3, currentIndex: -1, shiftKey: true }, 2],
    [{ focusableCount: 3, currentIndex: 1, shiftKey: false }, null],
    [{ focusableCount: 0, currentIndex: -1, shiftKey: false }, null],
  ])("returns the focus target required to keep Tab inside the drawer", (input, expected) => {
    expect(getFocusTrapTargetIndex(input)).toBe(expected);
  });

  it.each([
    [
      [
        { isActive: false, isVisible: true },
        { isActive: true, isVisible: true },
      ],
      1,
    ],
    [
      [
        { isActive: true, isVisible: false },
        { isActive: false, isVisible: true },
      ],
      1,
    ],
    [[{ isActive: false, isVisible: false }], null],
  ])(
    "selects an active visible desktop destination before its visible fallback",
    (items, expected) => {
      expect(getAdminDesktopFocusTargetIndex(items)).toBe(expected);
    },
  );

  it.each([
    [
      "the managed desktop destination still owns focus",
      {
        isMobileViewport: true,
        focusWasMovedToDesktop: true,
        activeElementIsManagedTarget: true,
        activeElementIsVisible: false,
      },
      true,
    ],
    [
      "focus moved to an element hidden by the mobile breakpoint",
      {
        isMobileViewport: true,
        focusWasMovedToDesktop: true,
        activeElementIsManagedTarget: false,
        activeElementIsVisible: false,
      },
      true,
    ],
    [
      "the user moved focus to a main control that remains visible",
      {
        isMobileViewport: true,
        focusWasMovedToDesktop: true,
        activeElementIsManagedTarget: false,
        activeElementIsVisible: true,
      },
      false,
    ],
    [
      "the drawer did not move focus to desktop",
      {
        isMobileViewport: true,
        focusWasMovedToDesktop: false,
        activeElementIsManagedTarget: false,
        activeElementIsVisible: false,
      },
      false,
    ],
    [
      "the viewport returned to desktop before the deferred restore",
      {
        isMobileViewport: false,
        focusWasMovedToDesktop: true,
        activeElementIsManagedTarget: true,
        activeElementIsVisible: false,
      },
      false,
    ],
  ])("restores the mobile trigger only when %s", (_case, input, expected) => {
    expect(shouldRestoreAdminMobileTriggerFocus(input)).toBe(expected);
  });
});
