import { describe, expect, it } from "vitest";

import {
  ADMIN_NAV_GROUPS,
  getAdminDesktopFocusTargetIndex,
  getAdminNavGroups,
  getAdminNavItemActivePath,
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
  });

  /**
   * A-32 — un grupo del sidebar se dibuja si **alguno** de sus ítems aplica, no si aplica el POS.
   *
   * El POS y el Historial son cosas distintas: el Historial lista cierres de caja y facturas, que
   * existen aunque ningún local tenga el mostrador prendido. El bug medía el grupo entero con el
   * permiso del POS, así que un manager sin POS disponible se quedaba sin poder auditar.
   */
  it.each(["owner", "manager"] as const)(
    "sin POS disponible, %s sigue viendo Cierres en Control",
    (role) => {
      const groups = getAdminNavGroups(role, { posAvailable: false });

      expect(groups.map((group) => group.label)).toContain("Control");
      expect(groups.flatMap((group) => group.items)).toContainEqual(
        expect.objectContaining({ href: "/admin/history/cierres", label: "Cierres" }),
      );
    },
  );

  it("un grupo sin ningún ítem que aplique no se dibuja", () => {
    // El cajero no administra caja ni ve el Historial: sin POS, Control queda sin ítems y no va.
    expect(groupLabels("cashier", false)).not.toContain("Control");
  });

  it("sin POS disponible, el cajero ve Órdenes y la cocina solo Órdenes: nada de Control", () => {
    expect(getAdminNavGroups("cashier", { posAvailable: false })).toEqual([
      { label: "Operación", items: [expect.objectContaining({ href: "/admin/orders" })] },
    ]);
    expect(getAdminNavGroups("kitchen", { posAvailable: false })).toEqual([
      { label: "Operación", items: [expect.objectContaining({ href: "/admin/orders" })] },
    ]);
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
    "ofrece Caja y aprobaciones a %s",
    (role) => {
      const items = flattenNavWithPos(role);
      expect(items).toContainEqual(
        expect.objectContaining({ href: "/admin/cash", label: "Caja" }),
      );
      expect(items).toContainEqual(
        expect.objectContaining({ href: "/admin/approvals", label: "Aprobaciones" }),
      );
    },
  );

  /**
   * Tarea 1 del brief (2026-09-17) — la caja se administra desde su propia pantalla, así que el cajero
   * **sí** entra a «Caja» (ahí abre y cierra su turno). Lo que no ve es «Aprobaciones» (de quien administra
   * el dinero), ni «Cierres», ni «Config de Caja»: no audita su propio turno ni firma las reglas del arqueo.
   */
  it("el cajero opera el POS y entra a Caja, pero no aprueba ni audita ni configura", () => {
    const items = flattenNavWithPos("cashier");
    expect(items).toContainEqual(expect.objectContaining({ href: "/admin/pos" }));
    expect(items).toContainEqual(expect.objectContaining({ href: "/admin/cash", label: "Caja" }));
    expect(items).not.toContainEqual(expect.objectContaining({ href: "/admin/approvals" }));
    expect(items).not.toContainEqual(expect.objectContaining({ href: "/admin/history/cierres" }));
    expect(items).not.toContainEqual(expect.objectContaining({ href: "/admin/cash/config" }));
  });

  /**
   * Fase 1a del rediseño de Caja (2026-09-19) — **el orden del grupo Control**.
   *
   * El brief lo fija: `POS · Caja · Cierres · Aprobaciones · Config de Caja`. Config de Caja va al final
   * porque se entra pocas veces; Cierres queda pegado a Caja porque es su lectura.
   */
  it("ordena Control como POS, Caja, Cierres, Aprobaciones y Config de Caja", () => {
    const control = getAdminNavGroups("owner", { posAvailable: true }).find(
      (group) => group.label === "Control",
    );

    expect(control?.items.map((item) => item.href)).toEqual([
      "/admin/pos",
      "/admin/cash",
      "/admin/history/cierres",
      "/admin/approvals",
      "/admin/cash/config",
    ]);
  });

  /**
   * Fase 1a — **Config de Caja es del dueño** y no depende del POS: las reglas del arqueo existen aunque
   * ningún local tenga el mostrador prendido. Los otros tres roles no ven la entrada (la pantalla también
   * los redirige: es defensa en profundidad, no la única puerta).
   */
  it("solo el owner ve Config de Caja, con o sin POS disponible", () => {
    expect(flattenNavWithPos("owner")).toContainEqual(
      expect.objectContaining({ href: "/admin/cash/config", label: "Config de Caja" }),
    );
    expect(flattenNav("owner")).toContainEqual(
      expect.objectContaining({ href: "/admin/cash/config", label: "Config de Caja" }),
    );

    for (const role of ["manager", "cashier", "kitchen"] as const) {
      expect(flattenNavWithPos(role)).not.toContainEqual(
        expect.objectContaining({ href: "/admin/cash/config" }),
      );
    }
  });

  it("keeps /admin/dashboard active for the Resumen compatibility redirect", () => {
    expect(isAdminNavItemActive("/admin/dashboard", "/admin")).toBe(true);
    expect(isAdminNavItemActive("/admin", "/admin")).toBe(true);
  });

  it("el historial de caja queda activo en la ruta del detalle", () => {
    expect(isAdminNavItemActive("/admin/cash", "/admin/cash")).toBe(true);
    expect(isAdminNavItemActive("/admin/cash/history/shift-1", "/admin/cash")).toBe(true);
  });

  /**
   * Fase 1a del rediseño de Caja (2026-09-19) — **Cierres**: el ítem del sidebar es el mismo que el del
   * Historial de siempre, renombrado y apuntando a la ruta de la tab (no se creó ninguna ruta nueva). Lo
   * ven owner y manager; el cajero no (se auditaría a sí mismo) y cocina tampoco, porque no maneja plata.
   */
  it.each(["owner", "manager"] as const)("ofrece Cierres a %s", (role) => {
    expect(flattenNavWithPos(role)).toContainEqual(
      expect.objectContaining({ href: "/admin/history/cierres", label: "Cierres" }),
    );
  });

  it("ni el cajero ni cocina ven Cierres", () => {
    expect(flattenNavWithPos("cashier")).not.toContainEqual(
      expect.objectContaining({ href: "/admin/history/cierres" }),
    );
    expect(flattenNavWithPos("kitchen")).not.toContainEqual(
      expect.objectContaining({ href: "/admin/history/cierres" }),
    );
  });

  /**
   * El ítem Cierres apunta a la tab, así que su `href` no alcanza para marcarlo activo en la otra tab
   * (Facturas), que es hermana suya. Por eso el ítem declara `matchPath` y el shell resuelve con
   * `getAdminNavItemActivePath`: sin eso, entrar a Facturas dejaría el sidebar sin nada activo.
   */
  it("el ítem Cierres queda activo en las dos tabs", () => {
    const cierres = flattenNavWithPos("owner").find(
      (item) => item.href === "/admin/history/cierres",
    );

    expect(cierres).toBeDefined();
    expect(isAdminNavItemActive("/admin/history/cierres", getAdminNavItemActivePath(cierres!))).toBe(
      true,
    );
    expect(isAdminNavItemActive("/admin/history/facturas", getAdminNavItemActivePath(cierres!))).toBe(
      true,
    );
    // Y no se marca activo en una ruta ajena que empiece igual por casualidad.
    expect(isAdminNavItemActive("/admin/history-otra", getAdminNavItemActivePath(cierres!))).toBe(
      false,
    );
  });

  it("un ítem sin matchPath se marca activo con su propio href", () => {
    const caja = flattenNavWithPos("owner").find((item) => item.href === "/admin/cash");

    expect(getAdminNavItemActivePath(caja!)).toBe("/admin/cash");
    expect(isAdminNavItemActive("/admin/cash", getAdminNavItemActivePath(caja!))).toBe(true);
    expect(isAdminNavItemActive("/admin/cash/history/shift-1", getAdminNavItemActivePath(caja!))).toBe(
      true,
    );
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
