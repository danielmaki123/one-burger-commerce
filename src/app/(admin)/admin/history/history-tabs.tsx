"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

import { Lock } from "lucide-react";

/**
 * Punto 2 del roadmap (2026-09-18) — la cabecera de la sección **Historial**.
 *
 * Las dos consultas (cierres y facturas) son tabs con URL propia y un solo ítem en el sidebar que queda
 * activo en las dos. El distintivo **Solo consulta** está a la vista porque la sección entera es de
 * lectura: acá no se cobra, no se cierra caja y —salvo anular una factura, que es del dueño— no se
 * cambia nada.
 */

const HISTORY_TABS = [
  { href: "/admin/history/cierres", label: "Cierres" },
  { href: "/admin/history/facturas", label: "Facturas" },
] as const;

export function HistoryTabs() {
  const pathname = usePathname();

  return (
    <div className="flex flex-wrap items-center gap-2">
      <nav aria-label="Secciones del Historial" className="flex flex-wrap gap-2">
        {HISTORY_TABS.map((tab) => {
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={isActive ? "page" : undefined}
              className={[
                "inline-flex min-h-11 items-center rounded-stitch-md border px-4 text-st-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary motion-reduce:transition-none",
                isActive
                  ? "border-brand-primary bg-brand-primary-muted text-brand-primary"
                  : "border-line-subtle bg-surface-card text-ink-secondary hover:bg-surface-elevated",
              ].join(" ")}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>

      <span
        data-testid="history-readonly-badge"
        className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-line-subtle bg-surface-card px-3 py-1.5 text-st-caption font-semibold uppercase tracking-wide text-ink-secondary"
      >
        <Lock aria-hidden="true" className="h-3.5 w-3.5" />
        Solo consulta
      </span>
    </div>
  );
}
