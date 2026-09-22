import {
  Bell,
  Calculator,
  ClipboardList,
  Coins,
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

import {
  canManageCash,
  canManageCashConfig,
  canUsePOS,
  canViewHistory,
} from "@/modules/auth/domain/admin-permissions";
import type { AdminRole } from "@/modules/auth/domain/admin-role";

export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /**
   * Fase 1a del rediseño de Caja (2026-09-19) — prefijo con el que el ítem se considera **activo**.
   *
   * Existe por el ítem *Cierres*, que apunta a una tab (`/admin/history/cierres`) de una sección con dos
   * tabs: con solo el `href`, entrar a Facturas dejaba el sidebar sin nada marcado. Cuando no está, el
   * activo se resuelve con el `href` (lo que hacía antes).
   */
  matchPath?: string;
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
 * «Caja» la ve **quien cobra** (el cajero incluido) desde que la caja se administra ahí: es donde abre y
 * cierra su turno. Lo que el cajero no ve es la mitad de auditoría de esa pantalla —cierres—, que se
 * resuelve adentro con `canViewCashHistory`. «Aprobaciones» sigue siendo de quien administra el dinero.
 */
export const ADMIN_CONTROL_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/cash", label: "Caja", description: "Turno, apertura y cierre", icon: ReceiptText },
  { href: "/admin/approvals", label: "Aprobaciones", description: "Devoluciones y ajustes", icon: ShieldCheck },
];

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — **Config de Caja**, la pantalla de las reglas del arqueo
 * (monedas que se cuentan, denominaciones y si el cajero ve el esperado).
 *
 * Es del **dueño** (`canManageCashConfig`) y no depende del POS: las reglas existen aunque ningún local
 * tenga el mostrador prendido. Va al final del grupo porque se entra pocas veces.
 */
export const ADMIN_CASH_CONFIG_NAV_ITEM: AdminNavItem = {
  href: "/admin/cash/config",
  label: "Config de Caja",
  description: "Monedas, denominaciones y arqueo",
  icon: Coins,
};

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — **Cierres**: el ítem del Historial, renombrado.
 *
 * La sección junta las dos consultas (cierres de caja y facturas) en dos tabs con URL propia. El `href`
 * es la tab de cierres —la que el brief pide— y `matchPath` mantiene el ítem activo también en Facturas:
 * sin eso, entrar a la otra tab dejaría el sidebar sin nada marcado.
 */
export const ADMIN_HISTORY_NAV_ITEM: AdminNavItem = {
  href: "/admin/history/cierres",
  label: "Cierres",
  description: "Cierres y facturas",
  icon: History,
  matchPath: "/admin/history",
};

const CONTROL_GROUP_LABEL = "Control";

function withControlGroup(
  groups: AdminNavGroup[],
  role: AdminRole | undefined,
  posAvailable: boolean,
): AdminNavGroup[] {
  /**
   * A-32 (2026-09-18) — **cada ítem con su propio permiso**.
   *
   * Antes el grupo entero se dibujaba solo si el POS estaba disponible (`if (!posAvailable) return
   * groups`), así que sin mostrador un manager perdía también la sección **Cierres**, que no depende del
   * POS: los cierres y las facturas existen igual. Lo que decide es si queda **al menos un ítem**.
   *
   * «Caja» se pide con `canUsePOS` **y** con el mostrador prendido en algún local: esa pantalla
   * es donde el cajero abre y cierra **su** turno, así que sin POS no tiene nada que hacer ahí —el
   * cajero no audita— y ofrecerla sería un enlace a una pantalla sin uso. **Cierres** y **Config de Caja**
   * no llevan `posAvailable`: la lectura de los cierres y las reglas del arqueo existen igual.
   */
  const items = [
    ...(posAvailable ? [ADMIN_POS_NAV_ITEM] : []),
    ...(posAvailable && role && canUsePOS(role) ? [ADMIN_CONTROL_NAV_ITEMS[0]] : []),
    ...(role && canViewHistory(role) ? [ADMIN_HISTORY_NAV_ITEM] : []),
    ...(role && canManageCash(role) ? [ADMIN_CONTROL_NAV_ITEMS[1]] : []),
    ...(role && canManageCashConfig(role) ? [ADMIN_CASH_CONFIG_NAV_ITEM] : []),
  ];

  // Un grupo sin ítems no se dibuja: un encabezado «Control» vacío no dice nada.
  if (items.length === 0) return groups;

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

/**
 * Fase 1a del rediseño de Caja (2026-09-19) — con qué ruta se mide si un ítem está activo.
 *
 * Lo usan los dos call sites del panel (el shell de escritorio y la navegación móvil) para no repetir el
 * `matchPath ?? href` en cada uno. `isAdminNavItemActive` no cambia: sigue midiendo contra una ruta.
 */
export function getAdminNavItemActivePath(item: Pick<AdminNavItem, "href" | "matchPath">): string {
  return item.matchPath ?? item.href;
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
