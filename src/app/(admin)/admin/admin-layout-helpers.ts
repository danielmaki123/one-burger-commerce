import {
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

export function getAdminNavGroups(role?: AdminRole): AdminNavGroup[] {
  if (role === "owner") return ADMIN_NAV_GROUPS;

  if (role === "manager") {
    return ADMIN_NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter((item) =>
        item.href === "/admin/orders" || item.href === "/admin/menu",
      ),
    })).filter((group) => group.items.length > 0);
  }

  if (role === "kitchen") {
    return [
      {
        label: "Operación",
        items: ADMIN_NAV_ITEMS.filter((item) => item.href === "/admin/orders"),
      },
    ];
  }

  return [
    {
      label: "Operación",
      items: ADMIN_NAV_ITEMS.filter((item) => item.href === "/admin/orders"),
    },
  ];
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
