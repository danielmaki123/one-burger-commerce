import {
  Calculator,
  ClipboardList,
  LayoutDashboard,
  MapPin,
  Settings,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";

import type { AdminRole } from "@/modules/auth/domain/admin-role";

export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Operación",
    items: [
      { href: "/admin", label: "Resumen", description: "Operación y rendimiento", icon: LayoutDashboard },
      { href: "/admin/orders", label: "Órdenes", description: "Cocina y servicio", icon: ClipboardList },
    ],
  },
  {
    label: "Configuración",
    items: [
      { href: "/admin/menu", label: "Menú", description: "Catálogo y promos", icon: UtensilsCrossed },
      { href: "/admin/locations", label: "Locales", description: "Retiro, horario y contacto", icon: MapPin },
      { href: "/admin/users", label: "Usuarios", description: "Roles y accesos", icon: Users },
      { href: "/admin/settings", label: "Personalización", description: "Marca y operación", icon: Settings },
    ],
  },
];

// Módulos fuera del MVP (reservas, mesas, delivery, inventario): sus páginas
// siguen en el repositorio pero no se ofrecen en la navegación del admin.
export const ADMIN_SECONDARY_NAV_ITEMS: AdminNavItem[] = [];

export const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

/**
 * TASK-308 — la caja del local.
 *
 * No está en `ADMIN_NAV_GROUPS` porque **no depende del rol sino del local**: el POS se prende por
 * sucursal, así que la entrada existe solo si algún local del staff lo tiene prendido. La navegación
 * lo pregunta una vez (`/api/admin/pos/availability`) y lo inyecta en Operación, que es donde está el
 * trabajo del día.
 */
export const ADMIN_POS_NAV_ITEM: AdminNavItem = {
  href: "/admin/pos",
  label: "Caja",
  description: "Venta de mostrador",
  icon: Calculator,
};

function withPosItem(groups: AdminNavGroup[], posAvailable: boolean): AdminNavGroup[] {
  if (!posAvailable) return groups;

  return groups.map((group) =>
    group.label === "Operación" ? { ...group, items: [...group.items, ADMIN_POS_NAV_ITEM] } : group,
  );
}

export function getAdminNavGroups(
  role?: AdminRole,
  options: { posAvailable?: boolean } = {},
): AdminNavGroup[] {
  const posAvailable = options.posAvailable ?? false;

  if (role === "owner") return withPosItem(ADMIN_NAV_GROUPS, posAvailable);

  if (role === "manager") {
    const groups = ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.href === "/admin/orders" || item.href === "/admin/menu",
      ),
    })).filter((group) => group.items.length > 0);

    return withPosItem(groups, posAvailable);
  }

  // Cocina no cobra: no ve la caja ni con el POS prendido.
  if (role === "kitchen") {
    return [
      {
        label: "Operación",
        items: ADMIN_NAV_ITEMS.filter((item) => item.href === "/admin/orders"),
      },
    ];
  }

  // Cajero (y el rato en que el rol todavía no se sabe): órdenes y, si hay mostrador, la caja.
  return withPosItem(
    [
      {
        label: "Operación",
        items: ADMIN_NAV_ITEMS.filter((item) => item.href === "/admin/orders"),
      },
    ],
    posAvailable,
  );
}

export function isAdminNavItemActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin" || pathname === "/admin/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function getFocusTrapTargetIndex({
  focusableCount,
  currentIndex,
  shiftKey,
}: {
  focusableCount: number;
  currentIndex: number;
  shiftKey: boolean;
}): number | null {
  if (focusableCount <= 0) return null;
  if (currentIndex < 0) return shiftKey ? focusableCount - 1 : 0;
  if (shiftKey && currentIndex === 0) return focusableCount - 1;
  if (!shiftKey && currentIndex === focusableCount - 1) return 0;
  return null;
}

export function getAdminDesktopFocusTargetIndex(
  items: ReadonlyArray<{ isActive: boolean; isVisible: boolean }>,
): number | null {
  const activeVisibleIndex = items.findIndex(
    (item) => item.isActive && item.isVisible,
  );
  if (activeVisibleIndex >= 0) return activeVisibleIndex;

  const visibleIndex = items.findIndex((item) => item.isVisible);
  return visibleIndex >= 0 ? visibleIndex : null;
}

export function shouldRestoreAdminMobileTriggerFocus({
  isMobileViewport,
  focusWasMovedToDesktop,
  activeElementIsManagedTarget,
  activeElementIsVisible,
}: {
  isMobileViewport: boolean;
  focusWasMovedToDesktop: boolean;
  activeElementIsManagedTarget: boolean;
  activeElementIsVisible: boolean;
}): boolean {
  return (
    isMobileViewport &&
    focusWasMovedToDesktop &&
    (activeElementIsManagedTarget || !activeElementIsVisible)
  );
}

export function getAdminNavLinkClassName(isActive: boolean) {
  return [
    "group inline-flex min-h-11 min-w-max items-center gap-2.5 rounded-lg border px-3 py-2 text-left text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none md:w-full md:min-w-0",
    isActive
      ? "border-brand bg-brand text-brand-foreground shadow-sm"
      : "border-border bg-card text-foreground hover:border-brand/40 hover:bg-accent hover:text-brand-strong",
  ].join(" ");
}

export function getAdminNavIconClassName(isActive: boolean) {
  return [
    "h-4 w-4 shrink-0",
    isActive ? "text-brand-foreground" : "text-muted-foreground group-hover:text-brand-strong",
  ].join(" ");
}
