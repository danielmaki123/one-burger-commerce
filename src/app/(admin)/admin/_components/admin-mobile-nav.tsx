"use client";

import Link from "next/link";
import {
  Calculator,
  ClipboardList,
  Ellipsis,
  LayoutDashboard,
  Table2,
  UtensilsCrossed,
  X,
  type LucideIcon,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  ADMIN_SECONDARY_NAV_ITEMS,
  type AdminNavGroup,
  type AdminNavItem,
  getFocusTrapTargetIndex,
  isAdminNavItemActive,
} from "../admin-layout-helpers";
import AdminSessionControls, {
  type AdminSessionState,
} from "./admin-session-controls";

const SHEET_FOCUSABLE_SELECTOR = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(",");

function getSheetFocusableElements(sheet: HTMLElement): HTMLElement[] {
  return Array.from(
    sheet.querySelectorAll<HTMLElement>(SHEET_FOCUSABLE_SELECTOR),
  ).filter(
    (element) =>
      !element.hidden && element.getAttribute("aria-hidden") !== "true",
  );
}

type AdminMobileTab = {
  href: string;
  label: string;
  icon: LucideIcon;
};

const ADMIN_MOBILE_TAB_DEFS: AdminMobileTab[] = [
  { href: "/admin", label: "Turno", icon: LayoutDashboard },
  { href: "/admin/orders", label: "Órdenes", icon: ClipboardList },
  // TASK-308: el POS es la pantalla del cajero, así que va en la barra y no escondida en «Más».
  // Bloque 8.2 del roadmap: se llama **POS**; «Caja» pasó a nombrar el control del dinero (/admin/cash).
  { href: "/admin/pos", label: "POS", icon: Calculator },
  { href: "/admin/menu", label: "Menú", icon: UtensilsCrossed },
  { href: "/admin/tables", label: "Mesas", icon: Table2 },
];

export default function AdminMobileNav({
  pathname,
  groups,
  session,
}: {
  pathname: string;
  groups: AdminNavGroup[];
  session: AdminSessionState;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const moreTriggerRef = useRef<HTMLButtonElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const wasOpenRef = useRef(false);

  const allItems = groups.flatMap((group) => group.items);
  const tabs = ADMIN_MOBILE_TAB_DEFS.filter((tab) =>
    allItems.some((item) => item.href === tab.href),
  );
  const moreItems: AdminNavItem[] = [
    ...allItems.filter(
      (item) => !tabs.some((tab) => tab.href === item.href),
    ),
    ...ADMIN_SECONDARY_NAV_ITEMS,
  ];
  const isMoreActive = moreItems.some((item) =>
    isAdminNavItemActive(pathname, item.href),
  );

  useEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 48rem)");
    const onChange = (event: MediaQueryListEvent) => {
      if (event.matches) setIsOpen(false);
    };
    if (mediaQuery.matches) setIsOpen(false);
    mediaQuery.addEventListener("change", onChange);
    return () => mediaQuery.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (!isOpen) return;

    const previousOverflow = document.body.style.overflow;
    const backgrounds = Array.from(
      document.querySelectorAll<HTMLElement>("[data-admin-background]"),
    );
    const previousBackgroundState = backgrounds.map((element) => ({
      element,
      inert: element.inert,
      ariaHidden: element.getAttribute("aria-hidden"),
    }));

    document.body.style.overflow = "hidden";
    for (const element of backgrounds) {
      element.inert = true;
      element.setAttribute("aria-hidden", "true");
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsOpen(false);
        return;
      }

      if (event.key === "Tab") {
        const sheet = sheetRef.current;
        if (!sheet) return;

        const focusableElements = getSheetFocusableElements(sheet);
        if (focusableElements.length === 0) {
          event.preventDefault();
          sheet.focus();
          return;
        }

        const currentIndex = focusableElements.findIndex(
          (element) => element === document.activeElement,
        );
        const targetIndex = getFocusTrapTargetIndex({
          focusableCount: focusableElements.length,
          currentIndex,
          shiftKey: event.shiftKey,
        });

        if (targetIndex !== null) {
          event.preventDefault();
          focusableElements[targetIndex]?.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      for (const previous of previousBackgroundState) {
        previous.element.inert = previous.inert;
        if (previous.ariaHidden === null) {
          previous.element.removeAttribute("aria-hidden");
        } else {
          previous.element.setAttribute("aria-hidden", previous.ariaHidden);
        }
      }
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) {
      wasOpenRef.current = true;
      const animationFrame = window.requestAnimationFrame(() => {
        const sheet = sheetRef.current;
        if (!sheet) return;
        const firstFocusableElement = getSheetFocusableElements(sheet)[0];
        if (firstFocusableElement) {
          firstFocusableElement.focus();
        } else {
          sheet.focus();
        }
      });
      return () => window.cancelAnimationFrame(animationFrame);
    }

    if (wasOpenRef.current) {
      wasOpenRef.current = false;
      moreTriggerRef.current?.focus();
    }
  }, [isOpen]);

  const closeSheet = () => setIsOpen(false);

  return (
    <div className="md:hidden">
      {isOpen ? (
        <button
          type="button"
          aria-label="Cerrar menú"
          tabIndex={-1}
          onClick={closeSheet}
          className="fixed inset-0 z-40 bg-coal/45 backdrop-blur-[1px] motion-reduce:backdrop-blur-none"
        />
      ) : null}

      <aside
        ref={sheetRef}
        id="admin-mobile-more-sheet"
        role="dialog"
        aria-modal="true"
        aria-label="Más secciones de administración"
        aria-hidden={!isOpen}
        inert={!isOpen}
        tabIndex={-1}
        className={[
          "fixed inset-x-0 bottom-0 z-50 flex max-h-[80vh] flex-col rounded-t-3xl border-t border-line-subtle bg-surface-card shadow-2xl transition-transform duration-200 ease-out motion-reduce:transition-none",
          isOpen ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
      >
        <div className="flex items-center justify-between gap-2 border-b border-line-subtle px-5 py-4">
          <p className="font-heading text-st-body-lg font-bold tracking-tight text-ink">
            Más secciones
          </p>
          <button
            type="button"
            aria-label="Cerrar menú de más secciones"
            onClick={closeSheet}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-stitch-md text-ink-secondary transition-colors hover:bg-surface-elevated hover:text-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary motion-reduce:transition-none"
          >
            <X className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          </button>
        </div>

        <nav
          className="flex-1 space-y-1.5 overflow-y-auto px-4 py-4"
          aria-label="Secciones secundarias"
        >
          {moreItems.map((item) => {
            const isActive = isAdminNavItemActive(pathname, item.href);
            const Icon = item.icon;

            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={isActive ? "page" : undefined}
                onClick={closeSheet}
                className={[
                  "flex min-h-11 items-center gap-3 rounded-stitch-md border px-3 py-2 text-st-body font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary motion-reduce:transition-none",
                  isActive
                    ? "border-transparent bg-brand-primary-muted text-brand-primary"
                    : "border-transparent text-ink hover:bg-surface-elevated hover:text-brand-primary",
                ].join(" ")}
              >
                <Icon className="h-5 w-5 shrink-0" strokeWidth={2} aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate">{item.label}</span>
                  <span className={isActive ? "block truncate text-st-caption text-brand-primary/80" : "block truncate text-st-caption text-ink-secondary"}>
                    {item.description}
                  </span>
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-line-subtle p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <AdminSessionControls session={session} />
        </div>
      </aside>

      <nav
        aria-label="Navegación principal"
        className="fixed inset-x-0 bottom-0 z-30 grid border-t border-line-subtle bg-surface-card pb-[env(safe-area-inset-bottom)]"
        style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}
      >
        {tabs.map((tab) => {
          const isActive = isAdminNavItemActive(pathname, tab.href);
          const Icon = tab.icon;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={[
                "flex min-h-14 flex-col items-center justify-center gap-1 text-st-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary motion-reduce:transition-none",
                isActive ? "text-brand-primary" : "text-ink-secondary hover:text-brand-primary",
              ].join(" ")}
            >
              <Icon className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
              {tab.label}
            </Link>
          );
        })}

        <button
          ref={moreTriggerRef}
          type="button"
          aria-controls="admin-mobile-more-sheet"
          aria-expanded={isOpen}
          aria-label={isOpen ? "Cerrar más secciones" : "Abrir más secciones"}
          onClick={() => setIsOpen((open) => !open)}
          className={[
            "flex min-h-14 flex-col items-center justify-center gap-1 text-st-caption font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand-primary motion-reduce:transition-none",
            isMoreActive || isOpen ? "text-brand-primary" : "text-ink-secondary hover:text-brand-primary",
          ].join(" ")}
        >
          <Ellipsis className="h-5 w-5" strokeWidth={2} aria-hidden="true" />
          Más
        </button>
      </nav>
    </div>
  );
}
