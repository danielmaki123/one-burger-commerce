import { describe, expect, it } from "vitest";

import type { AdminRole } from "@/modules/auth/domain/admin-role";

import {
  ADMIN_MOBILE_TAB_HREFS,
  ADMIN_NAV_GROUPS,
  ADMIN_NAV_ITEMS,
  ADMIN_PRIMARY_NAV_ITEMS,
  getAdminDesktopFocusTargetIndex,
  getAdminNavigation,
  getAdminNavItemActivePath,
  getFocusTrapTargetIndex,
  isAdminNavItemActive,
  shouldRestoreAdminMobileTriggerFocus,
} from "./admin-layout-helpers";

/** Todas las entradas que un rol ve, en el orden en que se dibujan (primary + grupos). */
function visibleHrefs(role: AdminRole | undefined, posAvailable = false) {
  const navigation = getAdminNavigation(role, { posAvailable });
  return [
    ...navigation.primary.map((item) => item.href),
    ...navigation.groups.flatMap((group) => group.items.map((item) => item.href)),
  ];
}

function groupLabels(role: AdminRole | undefined, posAvailable = true) {
  return getAdminNavigation(role, { posAvailable }).groups.map((group) => group.label);
}

function groupHrefs(role: AdminRole | undefined, label: string, posAvailable = true) {
  const group = getAdminNavigation(role, { posAvailable }).groups.find(
    (candidate) => candidate.label === label,
  );

  return group?.items.map((item) => item.href) ?? [];
}

/**
 * TASK-IA-001 — la arquitectura de navegación aprobada por el owner.
 *
 * `RESUMEN` es una entrada **superior**, fuera de los grupos; `OPERACIÓN` tiene Órdenes y POS; `CONTROL` el
 * dinero; `CATÁLOGO` las cinco entradas del catálogo como hermanas (el hub «Menú» deja de ser entrada); y
 * `CONFIGURACIÓN` el negocio. **Una sola fuente** gobierna desktop y mobile.
 */
describe("admin layout helpers", () => {
  it("Resumen es una entrada superior y NO pertenece a Operación", () => {
    const navigation = getAdminNavigation("owner", { posAvailable: true });

    expect(navigation.primary.map((item) => item.href)).toEqual(["/admin"]);
    expect(navigation.primary[0]?.label).toBe("Resumen");
    expect(groupHrefs("owner", "Operación")).not.toContain("/admin");
    expect(ADMIN_PRIMARY_NAV_ITEMS.map((item) => item.href)).toEqual(["/admin"]);
  });

  it("Operación tiene Órdenes y POS, en ese orden, y el POS ya no está en Control", () => {
    expect(groupHrefs("owner", "Operación")).toEqual(["/admin/orders", "/admin/pos"]);
    expect(groupHrefs("owner", "Control")).not.toContain("/admin/pos");
  });

  it("Control mantiene Caja, Cierres, Aprobaciones y Config de Caja", () => {
    expect(groupHrefs("owner", "Control")).toEqual([
      "/admin/cash",
      "/admin/history/cierres",
      "/admin/approvals",
      "/admin/cash/config",
    ]);
  });

  it("Catálogo expone las cinco entradas hermanas, en el orden aprobado", () => {
    expect(groupHrefs("owner", "Catálogo")).toEqual([
      "/admin/menu/products",
      "/admin/menu/categories",
      "/admin/menu/modifier-groups",
      "/admin/promotions",
      "/admin/menu/marketing-blocks",
    ]);

    const labels = getAdminNavigation("owner", { posAvailable: true }).groups
      .find((group) => group.label === "Catálogo")
      ?.items.map((item) => item.label);

    expect(labels).toEqual([
      "Productos",
      "Categorías",
      "Modificadores",
      "Promociones",
      "Contenido",
    ]);
  });

  it("«Menú» deja de ser una entrada de navegación", () => {
    expect(ADMIN_NAV_ITEMS.map((item) => item.href)).not.toContain("/admin/menu");
    expect(ADMIN_NAV_ITEMS.map((item) => item.label)).not.toContain("Menú");
  });

  it("Subcategorías no tiene entrada propia: vive dentro de Categorías", () => {
    expect(ADMIN_NAV_ITEMS.filter((item) => item.href.includes("subcategor"))).toEqual([]);
  });

  it("Configuración conserva las cuatro pantallas del negocio", () => {
    expect(groupHrefs("owner", "Configuración")).toEqual([
      "/admin/locations",
      "/admin/users",
      "/admin/settings",
      "/admin/settings/notifications",
    ]);
  });

  it("la barra móvil sale de la misma fuente y no tiene entradas muertas", () => {
    const hrefs = ADMIN_NAV_ITEMS.map((item) => item.href);

    for (const tab of ADMIN_MOBILE_TAB_HREFS) {
      expect(hrefs, `la pestaña ${tab} tiene que existir en la navegación`).toContain(tab);
    }

    // «Mesas» estaba en la barra móvil y no pertenece a ningún grupo: nunca se dibujaba.
    expect(ADMIN_MOBILE_TAB_HREFS).not.toContain("/admin/tables");
    expect(ADMIN_MOBILE_TAB_HREFS).not.toContain("/admin/menu");
  });

  it("shows Usuarios and Locales to owner only", () => {
    expect(visibleHrefs("owner")).toContain("/admin/users");
    expect(visibleHrefs("owner")).toContain("/admin/locations");

    for (const role of ["manager", "kitchen", "cashier"] as const) {
      expect(visibleHrefs(role)).not.toContain("/admin/users");
      expect(visibleHrefs(role)).not.toContain("/admin/locations");
    }
  });

  it.each([undefined, "manager", "kitchen", "cashier"] as const)(
    "does not expose /admin summary before owner access is known (%s)",
    (role) => {
      expect(visibleHrefs(role)).not.toContain("/admin");
    },
  );

  it("lets kitchen see only orders", () => {
    expect(visibleHrefs("kitchen", true)).toEqual(["/admin/orders"]);
    expect(groupLabels("kitchen")).toEqual(["Operación"]);
  });

  /**
   * Aprobaciones — la entrada usa la **misma** puerta que la pantalla (`canApproveRefund`, solo el owner).
   * Antes se ofrecía al manager y la pantalla lo rebotaba: era un bug de navegación.
   */
  it("Aprobaciones solo se ofrece a quien puede entrar (owner)", () => {
    expect(visibleHrefs("owner", true)).toContain("/admin/approvals");

    for (const role of ["manager", "cashier", "kitchen"] as const) {
      expect(visibleHrefs(role, true)).not.toContain("/admin/approvals");
    }
  });

  it("el manager ve Catálogo completo y Control sin Aprobaciones ni Config de Caja", () => {
    expect(groupLabels("manager")).toEqual(["Operación", "Control", "Catálogo"]);
    expect(groupHrefs("manager", "Control")).toEqual([
      "/admin/cash",
      "/admin/history/cierres",
    ]);
    expect(groupHrefs("manager", "Catálogo")).toEqual([
      "/admin/menu/products",
      "/admin/menu/categories",
      "/admin/menu/modifier-groups",
      "/admin/promotions",
      "/admin/menu/marketing-blocks",
    ]);
  });

  it("el cajero opera el POS y entra a Caja, pero no aprueba ni audita ni configura ni toca catálogo", () => {
    const hrefs = visibleHrefs("cashier", true);

    expect(hrefs).toEqual(["/admin/orders", "/admin/pos", "/admin/cash"]);
    expect(hrefs).not.toContain("/admin/menu/products");
    expect(hrefs).not.toContain("/admin/promotions");
  });

  it("la disponibilidad del POS decide POS y Caja, y no depende de ella Cierres", () => {
    expect(visibleHrefs("owner", false)).not.toContain("/admin/pos");
    expect(visibleHrefs("owner", false)).not.toContain("/admin/cash");
    expect(visibleHrefs("owner", false)).toContain("/admin/history/cierres");

    expect(visibleHrefs("owner", true)).toContain("/admin/pos");
    expect(visibleHrefs("owner", true)).toContain("/admin/cash");
  });

  it("un grupo sin ningún ítem que aplique no se dibuja", () => {
    expect(groupLabels("cashier", false)).not.toContain("Control");
    expect(groupLabels("kitchen", true)).toEqual(["Operación"]);
    expect(groupLabels("cashier", true)).not.toContain("Catálogo");
  });

  it("el orden de los grupos es Operación, Control, Catálogo y Configuración", () => {
    expect(groupLabels("owner", true)).toEqual([
      "Operación",
      "Control",
      "Catálogo",
      "Configuración",
    ]);
    expect(ADMIN_NAV_GROUPS.map((group) => group.label)).toEqual([
      "Operación",
      "Control",
      "Catálogo",
      "Configuración",
    ]);
  });

  it("keeps /admin/dashboard active for the Resumen compatibility redirect", () => {
    expect(isAdminNavItemActive("/admin/dashboard", "/admin")).toBe(true);
    expect(isAdminNavItemActive("/admin", "/admin")).toBe(true);
  });

  /**
   * Los estados activos de las rutas profundas: cada entrada del catálogo tiene que quedar marcada en su
   * detalle, y Cierres sigue cubriendo las dos tabs del Historial con su `matchPath`.
   */
  it.each([
    ["/admin/menu/products", "/admin/menu/products/nuevo"],
    ["/admin/menu/products", "/admin/menu/products/prod-1"],
    ["/admin/menu/categories", "/admin/menu/categories/cat-1"],
    ["/admin/menu/modifier-groups", "/admin/menu/modifier-groups/grp-1"],
    ["/admin/promotions", "/admin/promotions/promo-1"],
    ["/admin/menu/marketing-blocks", "/admin/menu/marketing-blocks/block-1"],
    ["/admin/pos", "/admin/pos/sale"],
    ["/admin/cash", "/admin/cash/history/shift-1"],
  ])("%s queda activo en la ruta profunda %s", (href, deepPath) => {
    const item = ADMIN_NAV_ITEMS.find((candidate) => candidate.href === href);

    expect(item, `falta la entrada ${href}`).toBeDefined();
    expect(isAdminNavItemActive(deepPath, getAdminNavItemActivePath(item!))).toBe(true);
  });

  it("Cierres queda activo en las dos tabs del Historial y no en una ruta ajena", () => {
    const cierres = ADMIN_NAV_ITEMS.find((item) => item.href === "/admin/history/cierres");

    expect(cierres).toBeDefined();
    expect(getAdminNavItemActivePath(cierres!)).toBe("/admin/history");
    expect(isAdminNavItemActive("/admin/history/cierres", getAdminNavItemActivePath(cierres!))).toBe(
      true,
    );
    expect(isAdminNavItemActive("/admin/history/facturas", getAdminNavItemActivePath(cierres!))).toBe(
      true,
    );
    expect(isAdminNavItemActive("/admin/history-otra", getAdminNavItemActivePath(cierres!))).toBe(
      false,
    );
  });

  it("un ítem sin matchPath se marca activo con su propio href", () => {
    const caja = ADMIN_NAV_ITEMS.find((item) => item.href === "/admin/cash");

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
