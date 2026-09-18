import {
  Bell,
  Calculator,
  ClipboardList,
  History,
  LayoutDashboard,
  MapPin,
  ReceiptText,
  Settings,
  ShieldCheck,
  UtensilsCrossed,
  Users,
  type LucideIcon,
} from "lucide-react";

import { canManageCash, canUsePOS, canViewHistory } from "@/modules/auth/domain/admin-permissions";
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

/**
 * Los cuatro grupos del panel (Bloque 8 del roadmap del POS, Fase 2).
 *
 * Antes eran dos («Operación» y «Configuración») y la caja se inyectaba dentro de Operación. El
 * dinero tiene su propio grupo —**Control**— porque es lo que se audita, y el catálogo el suyo
 * —**Catálogo**— porque lo toca el manager y la configuración del negocio no.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  {
    label: "Operación",
    items: [
      { href: "/admin", label: "Resumen", description: "Operación y rendimiento", icon: LayoutDashboard },
      { href: "/admin/orders", label: "Órdenes", description: "Cocina y servicio", icon: ClipboardList },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { href: "/admin/menu", label: "Menú", description: "Catálogo y promos", icon: UtensilsCrossed },
    ],
  },
  {
    label: "Configuración",
    items: [
      { href: "/admin/locations", label: "Locales", description: "Retiro, horario y contacto", icon: MapPin },
      { href: "/admin/users", label: "Usuarios", description: "Roles y accesos", icon: Users },
      { href: "/admin/settings", label: "Personalización", description: "Marca y operación", icon: Settings },
      /**
       * Decisión del owner (2026-09-17) — las **alertas** son una pantalla del negocio, no un rincón de
       * Personalización: se llega desde el sidebar como cualquier otra configuración (antes solo había un
       * enlace adentro de Personalización). Es del owner, así que tampoco se le ofrece a los otros roles.
       */
      {
        href: "/admin/settings/notifications",
        label: "Alertas",
        description: "Notificaciones y avisos",
        icon: Bell,
      },
    ],
  },
];

// Módulos fuera del MVP (reservas, mesas, delivery, inventario): sus páginas
// siguen en el repositorio pero no se ofrecen en la navegación del admin.
export const ADMIN_SECONDARY_NAV_ITEMS: AdminNavItem[] = [];

export const ADMIN_NAV_ITEMS = ADMIN_NAV_GROUPS.flatMap((group) => group.items);

const OPERATION_GROUP = ADMIN_NAV_GROUPS[0];
const CATALOG_GROUP = ADMIN_NAV_GROUPS[1];

/**
 * Bloque 8.2 del roadmap — la pantalla del mostrador se llama **POS** (antes «Caja»).
 *
 * La ruta sigue siendo `/admin/pos`: la entrada `Caja` pasó a nombrar el **control del dinero**
 * (`/admin/cash`, historial de cierres), así que el nombre y la ruta dejaron de estar cruzados.
 */
export const ADMIN_POS_NAV_ITEM: AdminNavItem = {
  href: "/admin/pos",
  label: "POS",
  description: "Venta de mostrador",
  icon: Calculator,
};

/**
 * Bloque 8.3 + tarea 1 del brief (2026-09-17) — las rutas del control.
 *
 * «Caja del día» la ve **quien cobra** (el cajero incluido) desde que la caja se administra ahí: es donde
 * abre y cierra su turno. Lo que el cajero no ve es la mitad de auditoría de esa pantalla —historial,
 * día consolidado y comparación—, que se resuelve adentro con `canViewCashHistory` (el cajero no audita su
 * propio turno). «Aprobaciones» sigue siendo de quien administra el dinero.
 */
export const ADMIN_CONTROL_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/cash", label: "Caja del día", description: "Cierres y movimientos", icon: ReceiptText },
  { href: "/admin/approvals", label: "Aprobaciones", description: "Devoluciones y ajustes", icon: ShieldCheck },
];

/**
 * Punto 2 del roadmap (2026-09-18) — **Historial**: una sola entrada para las dos consultas.
 *
 * El owner pidió un ítem único en Control que quede activo en las dos tabs, y por eso el `href` es la
 * sección (`/admin/history`, que redirige a los cierres) y no una de las tabs: así
 * `isAdminNavItemActive` lo marca en `/admin/history/cierres` y en `/admin/history/facturas` sin reglas
 * especiales. Es de consulta: lo ven owner y manager, no el cajero (se auditaría a sí mismo) ni cocina.
 */
export const ADMIN_HISTORY_NAV_ITEM: AdminNavItem = {
  href: "/admin/history",
  label: "Historial",
  description: "Cierres y facturas",
  icon: History,
};

const CONTROL_GROUP_LABEL = "Control";

function withControlGroup(
  groups: AdminNavGroup[],
  role: AdminRole | undefined,
  posAvailable: boolean,
): AdminNavGroup[] {
  if (!posAvailable) return groups;

  // La caja se administra desde su pantalla (tarea 1 del brief): la ve quien cobra. Las aprobaciones
  // siguen siendo de quien administra el dinero.
  const items = [
    ADMIN_POS_NAV_ITEM,
    ...(role && canUsePOS(role) ? [ADMIN_CONTROL_NAV_ITEMS[0]] : []),
    ...(role && canManageCash(role) ? [ADMIN_CONTROL_NAV_ITEMS[1]] : []),
    ...(role && canViewHistory(role) ? [ADMIN_HISTORY_NAV_ITEM] : []),
  ];

  const next: AdminNavGroup[] = [];
  for (const group of groups) {
    next.push(group);
    // El grupo Control va después de Operación: primero el turno, después la plata del turno.
    if (group.label === OPERATION_GROUP.label) {
      next.push({ label: CONTROL_GROUP_LABEL, items });
    }
  }

  return next;
}

function onlyHrefs(group: AdminNavGroup, hrefs: readonly string[]): AdminNavGroup {
  return { ...group, items: group.items.filter((item) => hrefs.includes(item.href)) };
}

export function getAdminNavGroups(
  role?: AdminRole,
  options: { posAvailable?: boolean } = {},
): AdminNavGroup[] {
  const posAvailable = options.posAvailable ?? false;

  if (role === "owner") return withControlGroup(ADMIN_NAV_GROUPS, role, posAvailable);

  if (role === "manager") {
    const groups = [
      onlyHrefs(OPERATION_GROUP, ["/admin/orders"]),
      onlyHrefs(CATALOG_GROUP, ["/admin/menu"]),
    ];

    return withControlGroup(groups, role, posAvailable);
  }

  // Cocina no cobra ni ve el catálogo completo: no ve el control ni con el POS prendido.
  if (role === "kitchen") {
    return [onlyHrefs(OPERATION_GROUP, ["/admin/orders"])];
  }

  // Cajero (y el rato en que el rol todavía no se sabe): órdenes y, si hay mostrador, el POS.
  return withControlGroup([onlyHrefs(OPERATION_GROUP, ["/admin/orders"])], role, posAvailable);
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
    "group inline-flex min-h-11 min-w-max items-center gap-2.5 rounded-stitch-md border px-3 py-2 text-left text-st-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand motion-reduce:transition-none md:w-full md:min-w-0",
    isActive
      ? "border-transparent bg-brand-primary-muted text-brand-primary"
      : "border-transparent bg-surface-card text-ink hover:bg-surface-elevated hover:text-brand-primary",
  ].join(" ");
}

export function getAdminNavIconClassName(isActive: boolean) {
  return [
    "h-4 w-4 shrink-0",
    isActive ? "text-brand-primary" : "text-ink-muted group-hover:text-brand-primary",
  ].join(" ");
}
