import {
  BadgePercent,
  Bell,
  Calculator,
  ClipboardList,
  Coins,
  History,
  LayoutDashboard,
  LayoutTemplate,
  MapPin,
  Package,
  ReceiptText,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Tag,
  Users,
  type LucideIcon,
} from "lucide-react";

import {
  canApproveRefund,
  canManageBusinessSettings,
  canManageCashConfig,
  canManageMenu,
  canManagePromotions,
  canManageUsers,
  canUsePOS,
  canViewAdminOverview,
  canViewHistory,
} from "@/modules/auth/domain/admin-permissions";
import type { AdminRole } from "@/modules/auth/domain/admin-role";

/** Lo que la navegación necesita saber para decidir qué se ofrece. */
export type AdminNavContext = {
  role?: AdminRole;
  posAvailable: boolean;
};

export type AdminNavItem = {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /**
   * Prefijo con el que el ítem se considera **activo**, cuando el `href` no alcanza.
   *
   * Existe por el ítem *Cierres*, que apunta a una tab (`/admin/history/cierres`) de una sección con dos
   * tabs: con solo el `href`, entrar a Facturas dejaba el sidebar sin nada marcado.
   */
  matchPath?: string;
  /**
   * TASK-IA-001 — la puerta de la **entrada**, que es **la misma** que la de su pantalla.
   *
   * Regla: una entrada nunca se ofrece a un rol que la pantalla rechaza. Cuando la pantalla y la entrada
   * pedían cosas distintas, ganaba la de la pantalla (era el caso de *Aprobaciones*, que se ofrecía al
   * manager y lo rebotaba a Órdenes).
   */
  canSee: (context: AdminNavContext) => boolean;
};

export type AdminNavGroup = {
  label: string;
  items: AdminNavItem[];
};

/** Resumen vive **fuera** de los grupos: es la entrada superior del panel. */
export type AdminNavigation = {
  primary: AdminNavItem[];
  groups: AdminNavGroup[];
};

const everyRole = () => true;

/**
 * RESUMEN — el overview transversal del owner. Va como **entrada superior**, no dentro de Operación: no es
 * una tarea de operación, es la vista que muestra señales de todos los módulos
 * (`ops/product/MODULE_ARCHITECTURE.md` §6).
 */
export const ADMIN_PRIMARY_NAV_ITEMS: AdminNavItem[] = [
  {
    href: "/admin",
    label: "Resumen",
    description: "Operación y rendimiento",
    icon: LayoutDashboard,
    canSee: ({ role }) => (role ? canViewAdminOverview(role) : false),
  },
];

/**
 * OPERACIÓN — el trabajo del día: las órdenes y el mostrador.
 *
 * El POS entró acá en TASK-IA-001: es una tarea de operación, no una pieza del control del dinero (que es
 * Caja, Cierres, Aprobaciones y Config de Caja).
 */
export const ADMIN_OPERATION_NAV_ITEMS: AdminNavItem[] = [
  { href: "/admin/orders", label: "Órdenes", description: "Cocina y servicio", icon: ClipboardList, canSee: everyRole },
  {
    href: "/admin/pos",
    label: "POS",
    description: "Venta de mostrador",
    icon: Calculator,
    // La entrada sigue a la disponibilidad real del mostrador y al permiso de operarlo.
    canSee: ({ role, posAvailable }) => posAvailable && Boolean(role && canUsePOS(role)),
  },
];

/**
 * CONTROL — el dinero del turno: dónde se cobra, dónde se audita y con qué reglas.
 *
 * «Caja» la ve **quien cobra** (el cajero incluido): es donde abre y cierra su turno. Lo que el cajero no ve
 * es la mitad de auditoría (Cierres), las devoluciones (Aprobaciones) ni las reglas del arqueo (Config).
 */
export const ADMIN_CONTROL_NAV_ITEMS: AdminNavItem[] = [
  {
    href: "/admin/cash",
    label: "Caja",
    description: "Turno, apertura y cierre",
    icon: ReceiptText,
    canSee: ({ role, posAvailable }) => posAvailable && Boolean(role && canUsePOS(role)),
  },
  {
    href: "/admin/history/cierres",
    label: "Cierres",
    description: "Cierres y facturas",
    icon: History,
    matchPath: "/admin/history",
    canSee: ({ role }) => Boolean(role && canViewHistory(role)),
  },
  {
    href: "/admin/approvals",
    label: "Aprobaciones",
    description: "Devoluciones y ajustes",
    icon: ShieldCheck,
    // La pantalla exige `canApproveRefund` (solo el owner): la entrada usa **esa** puerta, no otra.
    canSee: ({ role }) => Boolean(role && canApproveRefund(role)),
  },
  {
    href: "/admin/cash/config",
    label: "Config de Caja",
    description: "Monedas, denominaciones y arqueo",
    icon: Coins,
    canSee: ({ role }) => Boolean(role && canManageCashConfig(role)),
  },
];

/**
 * CATÁLOGO — lo que el negocio vende y cómo lo presenta.
 *
 * TASK-IA-001: el hub «Menú» deja de ser una entrada de navegación y sus capacidades pasan a ser **entradas
 * hermanas**. Siguen siendo **un solo conjunto conceptual** (el catálogo) y **un solo módulo de dominio**
 * (`menu`): esto no crea cinco módulos nuevos.
 *
 * Subcategorías pertenece a **Categorías** y no tiene entrada propia.
 */
export const ADMIN_CATALOG_NAV_ITEMS: AdminNavItem[] = [
  {
    href: "/admin/menu/products",
    label: "Productos",
    description: "Platos, precios y modificadores",
    icon: Package,
    canSee: ({ role }) => Boolean(role && canManageMenu(role)),
  },
  {
    href: "/admin/menu/categories",
    label: "Categorías",
    description: "Cómo se agrupa la carta",
    icon: Tag,
    canSee: ({ role }) => Boolean(role && canManageMenu(role)),
  },
  {
    href: "/admin/menu/modifier-groups",
    label: "Modificadores",
    description: "Opciones y adicionales",
    icon: SlidersHorizontal,
    canSee: ({ role }) => Boolean(role && canManageMenu(role)),
  },
  {
    href: "/admin/promotions",
    label: "Promociones",
    description: "Cupones y combos",
    icon: BadgePercent,
    // `canManagePromotions` es una responsabilidad propia, aunque hoy coincida con `canManageMenu`.
    canSee: ({ role }) => Boolean(role && canManagePromotions(role)),
  },
  {
    href: "/admin/menu/marketing-blocks",
    label: "Contenido",
    description: "Bloques de la carta y la home",
    icon: LayoutTemplate,
    canSee: ({ role }) => Boolean(role && canManageMenu(role)),
  },
];

/** CONFIGURACIÓN — el negocio: dónde, quién, con qué marca y con qué avisos. */
export const ADMIN_CONFIGURATION_NAV_ITEMS: AdminNavItem[] = [
  {
    href: "/admin/locations",
    label: "Locales",
    description: "Retiro, horario y contacto",
    icon: MapPin,
    canSee: ({ role }) => Boolean(role && canManageBusinessSettings(role)),
  },
  {
    href: "/admin/users",
    label: "Usuarios",
    description: "Roles y accesos",
    icon: Users,
    canSee: ({ role }) => Boolean(role && canManageUsers(role)),
  },
  {
    href: "/admin/settings",
    label: "Personalización",
    description: "Marca y operación",
    icon: Settings,
    canSee: ({ role }) => Boolean(role && canManageBusinessSettings(role)),
  },
  /**
   * Decisión del owner (2026-09-17) — las **alertas** son una pantalla del negocio, no un rincón de
   * Personalización: se llega desde el sidebar como cualquier otra configuración.
   */
  {
    href: "/admin/settings/notifications",
    label: "Alertas",
    description: "Notificaciones y avisos",
    icon: Bell,
    canSee: ({ role }) => Boolean(role && canManageBusinessSettings(role)),
  },
];

/**
 * Los cuatro grupos del panel, en el orden en que se dibujan.
 *
 * El grupo **Control** va después de **Operación**: primero el turno, después la plata del turno.
 */
export const ADMIN_NAV_GROUPS: AdminNavGroup[] = [
  { label: "Operación", items: ADMIN_OPERATION_NAV_ITEMS },
  { label: "Control", items: ADMIN_CONTROL_NAV_ITEMS },
  { label: "Catálogo", items: ADMIN_CATALOG_NAV_ITEMS },
  { label: "Configuración", items: ADMIN_CONFIGURATION_NAV_ITEMS },
];

// Módulos fuera del MVP (reservas, mesas, delivery, inventario): sus páginas siguen en el repositorio pero
// no se ofrecen en la navegación del admin.
export const ADMIN_SECONDARY_NAV_ITEMS: AdminNavItem[] = [];

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  ...ADMIN_PRIMARY_NAV_ITEMS,
  ...ADMIN_NAV_GROUPS.flatMap((group) => group.items),
];

/**
 * Las entradas que van en la **barra inferior del móvil**; el resto cae en «Más».
 *
 * Son solo `href`: el label, el icono y el permiso salen de la **misma** fuente que el sidebar, así que
 * desktop y mobile no pueden divergir. Antes había un array propio con labels e iconos duplicados (y una
 * entrada muerta, «Mesas», que ningún grupo contenía y por eso nunca se dibujaba).
 */
export const ADMIN_MOBILE_TAB_HREFS = ["/admin", "/admin/orders", "/admin/pos"] as const;

function withVisibleItems(
  items: AdminNavItem[],
  context: AdminNavContext,
): AdminNavItem[] {
  return items.filter((item) => item.canSee(context));
}

/**
 * La navegación de un rol: **una sola fuente** para el sidebar y la barra móvil.
 *
 * Un grupo sin ítems visibles no se devuelve: un encabezado vacío no dice nada.
 */
export function getAdminNavigation(
  role?: AdminRole,
  options: { posAvailable?: boolean } = {},
): AdminNavigation {
  const context: AdminNavContext = { role, posAvailable: options.posAvailable ?? false };

  const groups = ADMIN_NAV_GROUPS.map((group) => ({
    label: group.label,
    items: withVisibleItems(group.items, context),
  })).filter((group) => group.items.length > 0);

  return {
    primary: withVisibleItems(ADMIN_PRIMARY_NAV_ITEMS, context),
    groups,
  };
}

export function isAdminNavItemActive(pathname: string, href: string) {
  if (href === "/admin") {
    return pathname === "/admin" || pathname === "/admin/dashboard";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

/**
 * Con qué ruta se mide si un ítem está activo. Lo usan los dos call sites del panel (el shell de escritorio y
 * la navegación móvil) para no repetir el `matchPath ?? href` en cada uno.
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
  const activeVisibleIndex = items.findIndex((item) => item.isActive && item.isVisible);
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
