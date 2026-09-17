import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

import { describe, expect, it } from "vitest";

const adminDir = path.resolve(__dirname);

function readAdminFile(relativePath: string) {
  return readFileSync(path.join(adminDir, relativePath), "utf8");
}

function readWorkspaceFile(relativePath: string) {
  return readFileSync(path.resolve(adminDir, "../../../..", relativePath), "utf8");
}

describe("admin ui contracts", () => {
  it("redirects reservation detail out of the pickup MVP", () => {
    const source = readAdminFile("reservations/[id]/page.tsx");

    expect(source).toContain('redirect("/admin/orders")');
    expect(source).not.toContain("useState<ReservationStatus>");
  });

  it("keeps reservation status labels only as legacy support", () => {
    const detailSource = readAdminFile("reservations/[id]/page.tsx");
    const statusSource = readAdminFile("reservations/reservation-status-ui.ts");

    expect(statusSource).toContain('requested: { label: "Pendiente"');
    expect(statusSource).toContain('no_show: { label: "No asistió"');
    expect(statusSource).not.toContain('no_show: { label: "No show"');
    expect(detailSource).toContain('redirect("/admin/orders")');
    expect(detailSource).not.toContain("getAdminReservationStatusLabel");
  });

  it("uses one accessible bottom tab bar with a More sheet for mobile navigation", () => {
    const shellSource = readAdminFile("_components/admin-shell.tsx");
    const navPath = path.join(adminDir, "_components/admin-mobile-nav.tsx");
    const drawerPath = path.join(adminDir, "_components/admin-mobile-drawer.tsx");
    const controlsSource = readAdminFile("_components/admin-session-controls.tsx");

    expect(shellSource).toContain("<AdminMobileNav pathname={pathname} groups={navGroups} session={session} />");
    expect(shellSource).toContain('fetch("/api/auth/admin/session"');
    expect(shellSource.match(/fetch\("\/api\/auth\/admin\/session"/g)).toHaveLength(1);
    expect(controlsSource).not.toContain('fetch("/api/auth/admin/session"');
    expect(controlsSource).toContain("session: AdminSessionState");
    expect(shellSource).toContain("<AdminSessionControls session={session} />");
    expect(shellSource).not.toContain("MOBILE_PRIMARY_NAV_ITEMS");
    expect(existsSync(drawerPath)).toBe(false);
    expect(existsSync(navPath)).toBe(true);
    if (!existsSync(navPath)) return;

    const navSource = readAdminFile("_components/admin-mobile-nav.tsx");
    expect(navSource).not.toContain('fetch("/api/auth/admin/session"');
    expect(navSource).toContain('aria-controls="admin-mobile-more-sheet"');
    expect(navSource).toContain("aria-expanded={isOpen}");
    expect(navSource).toContain("inert={!isOpen}");
    expect(navSource).toContain('event.key === "Escape"');
    expect(navSource).toContain('event.key === "Tab"');
    expect(navSource).toContain("getFocusTrapTargetIndex");
    expect(navSource).toContain("const firstFocusableElement");
    expect(navSource).toContain("moreTriggerRef.current?.focus()");
    expect(navSource).toContain('document.querySelectorAll<HTMLElement>("[data-admin-background]")');
    expect(navSource).toContain("element.inert = true");
    expect(navSource).toContain('element.setAttribute("aria-hidden", "true")');
    expect(navSource).toContain("element.inert = previous.inert");
    expect(shellSource.match(/data-admin-background/g)).toHaveLength(2);
    expect(shellSource).toMatch(/<aside[\s\S]*?data-admin-background/);
    expect(shellSource).toMatch(/<main[\s\S]*?data-admin-background/);
    expect(navSource).toContain("document.body.style.overflow");
    expect(navSource).toContain('window.matchMedia("(min-width: 48rem)")');
    expect(navSource).toContain('mediaQuery.addEventListener("change"');
    expect(navSource).toContain('mediaQuery.removeEventListener("change"');
    expect(navSource).toContain("if (event.matches) setIsOpen(false)");
    expect(navSource).toMatch(
      /<aside[\s\S]*?<button[\s\S]*?aria-label="Cerrar menú de más secciones"[\s\S]*?onClick=\{closeSheet\}[\s\S]*?min-h-11[\s\S]*?min-w-11[\s\S]*?<\/button>[\s\S]*?<\/aside>/,
    );
    expect(navSource).toContain("motion-reduce:transition-none");
    expect(navSource).toContain("AdminSessionControls");
    expect(navSource).toContain("<AdminSessionControls session={session} />");
    expect(navSource).toContain("aria-current={isActive ? \"page\" : undefined}");
    expect(navSource).toContain('label: "Turno"');
    expect(navSource).toContain('label: "Órdenes"');
    expect(navSource).toContain('label: "Menú"');
    expect(navSource).toContain('label: "Mesas"');
    expect(navSource).toContain("min-h-14");
    expect(navSource).toContain("pb-[env(safe-area-inset-bottom)]");
    expect(shellSource).toContain("pb-24");
  });

  it("uses one direct accessible link for unauthenticated admin sessions", () => {
    const controlsSource = readAdminFile("_components/admin-session-controls.tsx");
    const loginLinkOpenings =
      controlsSource.match(
        /<Link\b(?=[^>]*\bhref="\/admin\/login")[^>]*>/g,
      ) ?? [];

    expect(loginLinkOpenings).toHaveLength(1);
    expect(controlsSource).not.toMatch(
      /<Link[^>]*href="\/admin\/login"[^>]*>\s*<Button[\s\S]*?<\/Button>\s*<\/Link>/,
    );
    expect(controlsSource).toMatch(
      /<Link\s+href="\/admin\/login"\s+className="[^"]*min-h-11[^"]*focus-visible:ring-2[^"]*"\s*>\s*Iniciar sesión\s*<\/Link>/,
    );
  });

  it("keeps authenticated logout at a 44px touch target while preserving pending state", () => {
    const controlsSource = readAdminFile("_components/admin-session-controls.tsx");

    expect(controlsSource).toMatch(
      /<Button\s+variant="outline"\s+size="sm"\s+className="[^"]*min-h-11[^"]*"/,
    );
    expect(controlsSource).toContain("disabled={loggingOut}");
    expect(controlsSource).toContain('loggingOut ? "Saliendo..." : "Cerrar sesión"');
  });

  it("groups the admin shell navigation for operational scanning", () => {
    const helperSource = readAdminFile("admin-layout-helpers.ts");
    const layoutSource = readAdminFile("layout.tsx");
    const shellSource = readAdminFile("_components/admin-shell.tsx");

    expect(helperSource).toContain("ADMIN_NAV_GROUPS");
    expect(helperSource).toContain("getAdminNavGroups");
    expect(helperSource).toContain('label: "Operación"');
    expect(helperSource).toContain('label: "Configuración"');
    expect(layoutSource).toContain('export const dynamic = "force-dynamic"');
    expect(layoutSource).toContain("AdminShell");
    expect(shellSource).toContain("admin-sidebar-shell");
    expect(shellSource).toContain("AdminSessionControls");
  });

  it("builds the owner-only Resumen shell without the retired dashboard modules", () => {
    const pageSource = readAdminFile("page.tsx");
    const overviewPath = path.join(adminDir, "_components/admin-overview-client.tsx");
    const navSource = readAdminFile("admin-layout-helpers.ts");

    expect(pageSource).toContain("requireAdminSession");
    expect(pageSource).toContain("canViewAdminOverview");
    expect(pageSource).toContain('redirect("/admin/orders")');
    expect(existsSync(overviewPath)).toBe(true);
    if (!existsSync(overviewPath)) return;

    const overviewSource = readAdminFile("_components/admin-overview-client.tsx");
    expect(overviewSource).toContain('title="Resumen"');
    expect(overviewSource).toContain(
      'description="Rendimiento de los pedidos para retirar en el período seleccionado."',
    );
    expect(overviewSource).not.toContain("Reservas del período");
    expect(overviewSource).not.toContain("Reservas hoy");
    expect(overviewSource).not.toContain('label: "Delivery"');
    expect(overviewSource).not.toContain("Estado actual de la operación");
    expect(overviewSource).not.toContain("Ahora");
    expect(overviewSource).not.toContain("Accesos directos");
    const turnoSource = readAdminFile("_components/admin-overview-turno.tsx");
    expect(overviewSource).toContain("<AdminOverviewTurno");
    expect(turnoSource).toContain('aria-label="Turno de hoy"');
    expect(turnoSource).toContain("Necesita atención ·");
    expect(turnoSource).toContain("Todo en orden: nada requiere atención inmediata.");
    expect(overviewSource).toContain('href: "/admin/orders"');
    expect(overviewSource).not.toContain('href: "/admin/reservations"');
    // El umbral de atraso del turno sale de `comanda-helpers` (la misma fuente que el KDS).
    expect(overviewSource).toContain("TURNO_THRESHOLDS");
    expect(overviewSource).not.toContain("TURNO_LATE_MINUTES = 20");
    expect(navSource).toContain('href: "/admin/orders"');
    expect(navSource).not.toContain('href: "/admin/reservations"');
    expect(navSource).toContain('href: "/admin/users"');
    // Los filtros son el segmentado del panel: primitivo `Tabs`, no botones crudos.
    expect(overviewSource).toContain("<TabsList");
    expect(overviewSource).toContain("<TabsTrigger");
    expect(overviewSource).toContain('ariaLabel="Período de rendimiento"');
    expect(overviewSource).toContain('ariaLabel="Canal de rendimiento"');
    expect(overviewSource).not.toContain("<button");
    expect(overviewSource).toContain("min-h-11");
    expect(overviewSource).not.toContain("loadOperations");
    expect(overviewSource).toContain("loadPerformance");
    expect(overviewSource).toContain("runAdminOverviewRequest");
    expect(overviewSource).not.toContain("operationsRetryNonce");
    expect(overviewSource).toContain("performanceRetryNonce");
    expect(overviewSource).toContain("setPerformanceRetryNonce");
    expect(overviewSource).not.toContain("onRetry={() => void loadPerformance");
    expect(overviewSource).not.toContain("/api/admin/overview/operations");
    expect(overviewSource).toContain("/api/admin/overview/performance");
    expect(overviewSource).toContain('role="alert"');
    expect(overviewSource).toContain("Reintentar");
    expect(overviewSource).toContain("motion-reduce:animate-none");
    expect(overviewSource).not.toContain("Dashboard operativo");
    expect(overviewSource).not.toContain("Pulso de operación");
    expect(overviewSource).not.toContain("Actividad reciente");
    expect(overviewSource).not.toContain("AdminStatusDonut");
    expect(overviewSource).not.toContain("Órdenes por atender");
    expect(overviewSource).not.toContain("Agenda de reservas");
    expect(overviewSource).not.toContain("\\uD83D");
  });

  it("renders performance filters with the panel segmented primitive", () => {
    const overviewSource = readAdminFile("_components/admin-overview-client.tsx");
    const tabsSource = readWorkspaceFile("src/shared/ui/tabs.tsx");

    // El estado activo y el mínimo táctil viven en el primitivo, no en cada pantalla.
    expect(tabsSource).toContain("aria-pressed={isActive}");
    expect(tabsSource).toContain('type="button"');
    expect(tabsSource).toContain("min-h-11");
    expect(tabsSource).toContain("bg-brand-primary-muted");
    expect(tabsSource).not.toContain("bg-card");
    expect(tabsSource).not.toContain("text-muted-foreground");

    expect(overviewSource).toContain('aria-label="Filtros de rendimiento"');
    expect(overviewSource).toContain('ariaLabel="Período de rendimiento"');
    expect(overviewSource).toContain('ariaLabel="Canal de rendimiento"');
    expect(overviewSource.match(/<TabsTrigger/g)).toHaveLength(2);
    expect(tabsSource).toContain("motion-reduce:transition-none");
  });

  it("el Resumen entero usa el sistema: sin alias viejos ni valores arbitrarios", () => {
    // Si un archivo de la pantalla vuelve a un alias viejo o a un `text-[Npx]`, el guardrail de techos
    // lo caza igual; acá se exige que **ninguno** de los seis archivos los use.
    const legacy = [
      'bg-card"',
      'border-border"',
      'text-foreground"',
      "text-muted-foreground",
      "text-[",
      "rounded-2xl",
      "shadow-sm",
    ];

    for (const file of [
      "_components/admin-overview-client.tsx",
      "_components/admin-overview-turno.tsx",
      "_components/admin-overview-metric-card.tsx",
      "_components/admin-overview-cocina.tsx",
      "_components/admin-overview-top-products.tsx",
      "_components/admin-overview-trend-chart.tsx",
    ]) {
      const source = readAdminFile(file);

      for (const legacyClass of legacy) {
        expect(source, `${file} usa ${legacyClass}`).not.toContain(legacyClass);
      }
    }
  });

  it("renders the pickup performance contract with three kpis and accessible data modules", () => {
    const overviewSource = readAdminFile("_components/admin-overview-client.tsx");
    const trendPath = path.join(
      adminDir,
      "_components/admin-overview-trend-chart.tsx",
    );

    const kpiDefinitions = overviewSource.match(
      /const PERFORMANCE_KPI_DEFINITIONS[\s\S]*?= \[([\s\S]*?)\n\];/,
    )?.[1];

    expect(kpiDefinitions).toBeDefined();
    expect(kpiDefinitions?.match(/metricKey:/g)).toHaveLength(3);
    expect(overviewSource).toContain('title: "Valor de órdenes completadas"');
    expect(overviewSource).toContain('title: "Órdenes completadas"');
    expect(overviewSource).toContain('title: "Ticket promedio"');
    expect(overviewSource).not.toContain('title: "Reservas vigentes"');
    expect(overviewSource).toContain("No equivale a pagos liquidados");
    expect(overviewSource).toContain("formatOverviewDelta(");
    expect(overviewSource).toContain("formatOverviewPeriodRange(");
    expect(overviewSource).toContain("<AdminOverviewTrendChart");
    expect(overviewSource).not.toContain("ADMIN_RESERVATION_STATUS_ORDER.map");
    expect(overviewSource).not.toContain("reservations");
    expect(overviewSource).toContain("topProducts.slice(0, 5)");
    expect(readAdminFile("_components/admin-overview-top-products.tsx")).toContain(
      'formatOverviewCount(product.units, "unidad", "unidades")',
    );
    expect(overviewSource).not.toContain(
      "${formatOverviewInteger(product.units)} unidades",
    );
    expect(existsSync(trendPath)).toBe(true);
    if (!existsSync(trendPath)) return;

    const trendSource = readAdminFile(
      "_components/admin-overview-trend-chart.tsx",
    );
    expect(trendSource).toContain("buildOverviewChartModel(series)");
    expect(trendSource).toContain("buildOverviewChartLabels(model)");
    expect(trendSource).toContain("<svg");
    expect(trendSource).toContain('role="img"');
    expect(trendSource).toContain("<title id=");
    expect(trendSource).toContain("<desc id=");
    expect(trendSource).toContain("<rect");
    expect(trendSource).toContain("<path");
    expect(trendSource).toContain("<circle");
    expect(trendSource).toContain("r={point.markerRadius}");
    expect(trendSource).toContain("Barras: valor completado");
    expect(trendSource).toContain("Línea: órdenes completadas");
    expect(trendSource).toContain(
      'formatOverviewCount(completedOrderCount, "orden completada", "órdenes completadas")',
    );
    expect(trendSource).toContain('aria-label="Etiquetas del gráfico"');
    expect(trendSource).toContain("left: `${label.leftPercent}%`");
    expect(trendSource).toContain(
      "transform: `translateX(${label.translatePercent}%)`",
    );
    expect(trendSource).not.toContain("gridTemplateColumns");
    expect(trendSource).not.toContain("<text");
    expect(trendSource).toContain("<details");
    expect(trendSource).toContain("<summary");
    expect(trendSource).toContain("<table");
    expect(trendSource).toContain("<caption");
    expect(trendSource).toContain('<th scope="col">Período</th>');
    expect(trendSource).toContain('<th scope="col">Valor</th>');
    expect(trendSource).toContain('<th scope="col">Órdenes</th>');
    expect(trendSource).toContain("overflow-hidden");
    expect(trendSource).not.toContain("overflow-visible");
    expect(trendSource).not.toContain("overflow-x-auto");
    expect(trendSource).not.toContain("onMouse");
  });

  it("keeps admin not-found navigation authorized and avoids nested controls", () => {
    const source = readAdminFile("not-found.tsx");

    expect(source).toContain('href="/admin/menu"');
    expect(source).toContain("Ir al menú");
    expect(source).not.toContain('href="/admin"');
    expect(source).not.toContain("<Button");
    expect(source).not.toContain('from "@/shared/ui/button"');
    expect(source).toContain("min-h-11");
  });

  it("keeps products operational without catalog kpis", () => {
    const source = readAdminFile("menu/products/page.tsx");
    const dishSource = readAdminFile("menu/products/product-dish-card.tsx");

    expect(source).not.toContain("Resumen del catálogo");
    expect(source).not.toContain("totalProducts");
    expect(source).not.toContain("activeProducts");
    expect(source).not.toContain("availableProducts");
    expect(source).not.toContain("withoutPhotoProducts");
    expect(dishSource).toContain("admin-product-thumb");
    expect(dishSource).toContain("Sin foto");
    expect(source).not.toContain("line-clamp-3");
    expect(source).not.toContain("0 fotos");
    expect(source).toContain("ProductDishCard");
    expect(source).not.toContain("Catálogo operativo");
  });

  it("renders the V2 dish grid with labeled availability switches", () => {
    const pageSource = readAdminFile("menu/products/page.tsx");
    const legacyControlsPath = path.join(adminDir, "menu/products/product-quick-controls.tsx");
    const cardPath = path.join(adminDir, "menu/products/product-dish-card.tsx");

    expect(pageSource).toContain("handleProductUpdated");
    expect(pageSource).toContain("<ProductDishCard");
    expect(pageSource).toContain("grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4");
    expect(pageSource).toContain("Agotados");
    expect(existsSync(legacyControlsPath)).toBe(false);
    expect(existsSync(cardPath)).toBe(true);
    if (!existsSync(cardPath)) return;

    const cardSource = readAdminFile("menu/products/product-dish-card.tsx");
    expect(cardSource).toContain('role="switch"');
    expect(cardSource).toContain("aria-checked={isAvailable}");
    expect(cardSource).toContain('aria-live="polite"');
    expect(cardSource).toContain("min-h-11");
    expect(cardSource).toContain("patchAdminProduct");
    expect(cardSource).toContain("formatCurrency");
    expect(cardSource).not.toContain(">$<");
  });

  it("uses compact operational navigation for the menu overview", () => {
    const source = readAdminFile("menu/page.tsx");

    expect(source).not.toContain("<Card");
    expect(source).not.toContain("Resumen rapido");
    expect(source).toContain("Catálogo operativo");
    expect(source).toContain("menu-section-row");
  });

  it("uses the Phase 2A shared operational UI primitives", () => {
    const componentSource = readAdminFile("_components/admin-operational-ui.tsx");
    const overviewSource = readAdminFile("_components/admin-overview-client.tsx");
    const productsSource = readAdminFile("menu/products/page.tsx");
    const ordersSource = readAdminFile("orders/page.tsx");

    expect(componentSource).toContain("AdminPageHeader");
    expect(componentSource).toContain("AdminMetricStrip");
    expect(componentSource).toContain("AdminCompactToolbar");
    expect(componentSource).toContain("AdminEmptyState");
    expect(componentSource).toContain("AdminStatusPill");
    expect(overviewSource).toContain("AdminPageHeader");
    expect(productsSource).toContain("AdminCompactToolbar");
    expect(ordersSource).toContain("ordersStatusCounts");
    expect(ordersSource).toContain("AdminCompactToolbar");
  });

  it("el panel de Locales usa el sistema: sin alias viejos ni valores arbitrarios", () => {
    const legacy = [
      'bg-card"',
      'border-border"',
      'text-foreground"',
      "text-muted-foreground",
      "text-[",
      "rounded-2xl",
      "shadow-sm",
    ];

    for (const file of [
      "locations/page.tsx",
      "locations/location-row.tsx",
      "locations/location-form-sheet.tsx",
    ]) {
      const source = readAdminFile(file);

      for (const legacyClass of legacy) {
        expect(source, `${file} usa ${legacyClass}`).not.toContain(legacyClass);
      }
    }

    // La fila se edita con una acción explícita y el catálogo del local vive en su propia pantalla.
    const rowSource = readAdminFile("locations/location-row.tsx");
    expect(rowSource).toContain("aria-label={`Editar local ${location.name}`}");
    expect(rowSource).toContain("aria-label={`Catálogo de ${location.name}`}");
    expect(rowSource).toContain("No recibe pedidos");
    expect(rowSource).toContain("font-mono");
  });

  it("el panel de Usuarios usa el sistema y conserva los accesos nombrados", () => {
    const legacy = [
      'bg-card"',
      'border-border"',
      "text-foreground",
      "text-muted-foreground",
      "text-[",
      "rounded-2xl",
      "shadow-sm",
    ];

    for (const file of [
      "users/users-client.tsx",
      "users/user-row.tsx",
      "users/user-create-form.tsx",
    ]) {
      const source = readAdminFile(file);

      for (const legacyClass of legacy) {
        expect(source, `${file} usa ${legacyClass}`).not.toContain(legacyClass);
      }
    }

    const rowSource = readAdminFile("users/user-row.tsx");
    expect(rowSource).toContain("aria-label={`Rol de ${user.name}`}");
    expect(rowSource).toContain("aria-label={`Revocar acceso de ${user.name}`}");
    expect(rowSource).toContain("Cambiar sucursales de {user.name}");
    expect(readAdminFile("users/user-create-form.tsx")).toContain(
      'aria-label="Rol del nuevo usuario"',
    );
  });

  it("el panel de Personalización usa el sistema y el primitivo de color", () => {
    const legacy = [
      'bg-card"',
      'border-border"',
      "text-foreground",
      "text-muted-foreground",
      "text-[",
      "rounded-2xl",
      "shadow-sm",
    ];

    for (const file of ["settings/settings-client.tsx", "settings/pickup-preview.tsx"]) {
      const source = readAdminFile(file);

      for (const legacyClass of legacy) {
        expect(source, `${file} usa ${legacyClass}`).not.toContain(legacyClass);
      }
    }

    const settingsSource = readAdminFile("settings/settings-client.tsx");
    // El color se elige con el primitivo y la vista previa toma la tipografía de un mapa de datos.
    expect(settingsSource).toContain("<ColorInput");
    expect(settingsSource).toContain("FONT_FAMILY_STYLE[draft.headingFont]");
    expect(settingsSource).not.toContain("#ffffff");
    // Los tres textos que el E2E usa como ancla siguen en la pantalla.
    expect(settingsSource).toContain('"Guardar cambios"');
    expect(settingsSource).toContain("Cambios guardados ✓");
    expect(readAdminFile("settings/page.tsx")).toContain("canManageBusinessSettings");
  });

  it("usa compact operational rows for secondary admin lists", () => {
    const tablesSource = readAdminFile("tables/page.tsx");
    const zonesSource = readAdminFile("delivery-zones/page.tsx");

    expect(tablesSource).toContain('redirect("/admin/orders")');
    expect(zonesSource).toContain("admin-compact-list");
  });

  it("keeps categories as an expandable hierarchy with a safe move dialog (V2)", () => {
    const source = readAdminFile("menu/categories/page.tsx");

    expect(source).toContain("expandedCategoryIds");
    expect(source).toContain("aria-expanded={isExpanded}");
    expect(source).toContain("aria-controls={`subcategory-list-${category.id}`}");
    expect(source).toContain("movingSubcategory");
    expect(source).toContain('role="dialog"');
    expect(source).toContain("Confirmar movimiento");
    expect(source).toContain("isSaving");
    expect(source).toContain("Guardando…");
    expect(source).not.toContain("CategoryEditDebugProbe");
  });

  it("edits categories in the shared edit sheet without navigation (V2)", () => {
    const source = readAdminFile("menu/categories/page.tsx");

    expect(source).toContain("AdminEditSheet");
    expect(source).toContain("sheetTarget");
    expect(source).toContain("closeSheet");
    expect(source).toContain("handleSave");
    expect(source).toContain("handleArchive");
    expect(source).not.toContain("window.confirm");
  });

  it("marks non-save category actions as buttons", () => {
    const source = readAdminFile("menu/categories/page.tsx");

    expect(source).toContain('type="button"');
    expect(source).toContain("onClick={closeSheet}");
  });

  it("removes the temporary category edit debug instrumentation", () => {
    const source = readAdminFile("menu/categories/page.tsx");

    expect(source).not.toContain("CategoryEditDebugProbe");
    expect(source).not.toContain("__categoryEditDebug");
    expect(existsSync(path.join(adminDir, "menu/categories/category-edit-debug-probe.tsx"))).toBe(false);
  });

  it("forces admin routes to be dynamic and not edge-cached", () => {
    const layoutSource = readAdminFile("layout.tsx");
    const nextConfigSource = readWorkspaceFile("next.config.ts");

    expect(layoutSource).toContain('export const dynamic = "force-dynamic"');
    expect(layoutSource).toContain("export const revalidate = 0");
    expect(nextConfigSource).toContain('source: "/admin/:path*"');
    expect(nextConfigSource).toContain('"Cache-Control"');
    expect(nextConfigSource).toContain('"no-store"');
  });

  it("keeps order filters readable on narrow screens", () => {
    const source = readAdminFile("orders/page.tsx");

    expect(source).not.toContain("overflow-x-auto");
    expect(source).toContain("flex flex-wrap");
    expect(source).toContain("min-h-11");
    expect(source).toContain("whitespace-nowrap");
  });

  it("keeps table capacity in one compact operational summary", () => {
    const source = readAdminFile("tables/page.tsx");

    expect(source).not.toContain("AdminMetricStrip");
    expect(source).toContain('redirect("/admin/orders")');
  });

  it("keeps delivery zone coverage in one compact operational summary", () => {
    const source = readAdminFile("delivery-zones/page.tsx");

    expect(source).not.toContain("AdminMetricStrip");
    expect(source).toContain("Resumen de zonas");
  });

  it("groups inventory work into one compact operational list", () => {
    const source = readAdminFile("inventory/page.tsx");

    expect(source).toContain("Operaciones de inventario");
    expect(source).toContain("min-h-16");
    expect(source).not.toContain("grid gap-6 md:grid-cols-2 lg:grid-cols-4");
  });

  it("shows inventory alerts and items as compact operational rows", () => {
    const alertSource = readAdminFile("inventory/alerts/page.tsx");
    const itemSource = readAdminFile("inventory/items/page.tsx");

    expect(alertSource).toContain('aria-label="Ítems con alerta"');
    expect(itemSource).toContain('aria-label="Listado de ítems de inventario"');
    expect(alertSource).not.toContain("md:grid-cols-2 lg:grid-cols-3");
    expect(itemSource).toContain("divide-y divide-line-subtle");
  });

  it("keeps daily inventory counts in one operational list", () => {
    const source = readAdminFile("inventory/count/page.tsx");

    expect(source).toContain('aria-label="Conteo de inventario"');
    expect(source).not.toContain("grid gap-6");
    expect(source).toContain("Confirmar conteo");
  });

  it("keeps product search visible and uses compact labeled filters", () => {
    const source = readAdminFile("menu/products/page.tsx");

    expect(source).not.toContain("AdminMetricStrip");
    expect(source).not.toContain("overflow-x-auto");
    expect(source).not.toContain("Resumen del catálogo");
    expect(source).toContain("countActiveProductFilters");
    expect(source).toContain("countProductsByCategory");
    expect(source).toContain("Limpiar filtros");
    expect(source).toContain("<select");
    expect(source).not.toContain("TabsTrigger");
    expect(source).toContain('aria-label="Filtros de productos"');
    expect(source).toContain("filtersOpen");
    expect(source).toContain("No se pudo cargar el catálogo");
    expect(source).toContain("Reintentar");
  });

  it("formats admin menu money with the configured currency helper (R2)", () => {
    const detailSource = readAdminFile("menu/products/[id]/page.tsx");
    const dishSource = readAdminFile("menu/products/product-dish-card.tsx");
    const modifierListSource = readAdminFile("menu/modifier-groups/page.tsx");
    const modifierHelperSource = readAdminFile("menu/modifier-groups/modifier-group-helpers.ts");
    const modifierDetailSource = readAdminFile("menu/modifier-groups/[id]/page.tsx");

    // El símbolo sale de la configuración del negocio, no de un "C$" escrito a
    // mano: el contrato pasó de exigir el literal a exigir el token configurado.
    expect(detailSource).toContain("label={`Precio base (${currency.symbol})`}");
    expect(detailSource).toContain("label={`Empaque por unidad (${currency.symbol})`}");
    expect(detailSource).toContain("formatCurrency(formData.basePrice, currency)");
    expect(detailSource).not.toContain("${formData.basePrice}");
    expect(detailSource).not.toContain("${formData.packagingFeeAmount");
    expect(dishSource).toContain("formatCurrency(product.basePrice, currency)");
    expect(modifierListSource).toContain("formatOptionPriceDelta");
    expect(modifierListSource).not.toContain("${opt.priceDelta}");
    expect(modifierHelperSource).toContain("formatCurrency(Math.abs(priceDelta), format)");
    expect(modifierDetailSource).toContain(
      "label={index === 0 ? `Recargo (${currency.symbol})` : undefined}",
    );
  });

  it("keeps menu configuration summaries and modifier groups compact (V2)", () => {
    const categorySource = readAdminFile("menu/categories/page.tsx");
    const modifierSource = readAdminFile("menu/modifier-groups/page.tsx");

    expect(categorySource).not.toContain("AdminMetricStrip");
    expect(categorySource).toContain("Orden de la carta");
    expect(modifierSource).toContain('aria-label="Listado de grupos de modificadores"');
    expect(modifierSource).toContain("describeModifierRule");
    expect(modifierSource).not.toContain("Seleccion:");
    expect(modifierSource).not.toContain("grid gap-6");
  });

  it("keeps marketing block creation on demand in the edit sheet (V2)", () => {
    const source = readAdminFile("menu/marketing-blocks/page.tsx");

    expect(source).toContain("sheetBlock");
    expect(source).toContain("AdminEditSheet");
    expect(source).toContain('aria-label="Listado de bloques comerciales"');
    expect(source).toContain("AdminPageHeader");
    expect(source).toContain("MARKETING_TYPE_LABELS");
    expect(source).not.toContain("block.type}</");
  });

  it("keeps reservation controls compact and reveals status filters on demand", () => {
    const source = readAdminFile("reservations/page.tsx");

    expect(source).not.toContain("AdminMetricStrip");
    expect(source).toContain('redirect("/admin/orders")');
    expect(source).not.toContain("Reservas del día");
    expect(source).not.toContain('aria-label="Filtros de reservas"');
  });

  it("keeps order operations compact and reveals secondary filters on demand", () => {
    const source = readAdminFile("orders/page.tsx");

    expect(source).not.toContain("AdminMetricStrip");
    expect(source).toContain("Órdenes en vista");
    expect(source).toContain("Mostrar filtros");
    expect(source).toContain('aria-label="Filtros de órdenes"');
    expect(source).toContain("filtersOpen");
  });

  it("removes technical internal copy from the order detail view", () => {
    const source = readAdminFile("orders/[id]/page.tsx");

    expect(source).not.toContain("enums ni revisar transiciones");
  });
});
