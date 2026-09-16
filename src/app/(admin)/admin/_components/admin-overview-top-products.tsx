"use client";

import { PackageSearch } from "lucide-react";

import type { OverviewTopProduct } from "@/modules/dashboard/domain/admin-overview.types";

import {
  formatOverviewCount,
  formatOverviewInteger,
} from "./admin-overview-formatters";
import { AdminEmptyState } from "./admin-operational-ui";
import { useCurrencyFormat } from "@/shared/lib/business-settings";
import { formatCurrency } from "@/shared/lib/format-currency";

/**
 * Top 5 de productos del período: unidades en mono, barra proporcional al primero y el valor
 * completado como dato secundario.
 *
 * La barra es `aria-hidden` a propósito: el número de unidades ya está en el texto y la
 * `progressbar` accesible vive en la fila, así que no se anuncia dos veces.
 */
export function AdminOverviewTopProducts({
  products,
}: {
  products: OverviewTopProduct[];
}) {
  const maxUnits = Math.max(1, ...products.map((product) => product.units));
  const currencyFormat = useCurrencyFormat();

  return (
    <section
      aria-labelledby="overview-products-title"
      className="min-w-0 rounded-stitch-lg border border-line-subtle bg-surface-card p-4 shadow-elevation-1 md:p-5"
    >
      <div>
        <h3 id="overview-products-title" className="font-heading text-st-h3 font-bold text-ink">
          Productos más vendidos
        </h3>
        <p className="mt-1 text-st-caption text-ink-secondary">
          Top 5 por unidades en órdenes completadas.
        </p>
      </div>

      {products.length > 0 ? (
        <ol aria-label="Top 5 de productos por unidades completadas" className="mt-4 space-y-3">
          {products.map((product, index) => (
            <li
              key={product.productId}
              className="min-w-0 rounded-stitch-md border border-line-subtle bg-surface-low p-3"
            >
              <div className="flex min-w-0 items-start justify-between gap-3">
                <p className="min-w-0 break-words text-st-body font-semibold text-ink">
                  <span className="mr-2 font-mono tabular-nums text-ink-muted">{index + 1}.</span>
                  {product.productName}
                </p>
                <p className="shrink-0 font-mono text-st-body font-bold tabular-nums text-ink">
                  {formatOverviewInteger(product.units)} unid.
                </p>
              </div>

              <div
                role="progressbar"
                aria-label={`${product.productName}: ${formatOverviewCount(product.units, "unidad", "unidades")}`}
                aria-valuemin={0}
                aria-valuemax={maxUnits}
                aria-valuenow={product.units}
                className="mt-3 h-2 overflow-hidden rounded-full bg-surface-elevated"
              >
                <div
                  className="h-full rounded-full bg-brand-primary"
                  style={{ width: `${(product.units / maxUnits) * 100}%` }}
                />
              </div>

              <p className="mt-2 text-st-caption leading-5 text-ink-secondary">
                Valor completado:{" "}
                <span className="break-all font-mono font-semibold tabular-nums text-ink">
                  {formatCurrency(product.completedOrderValue, currencyFormat)}
                </span>
              </p>
            </li>
          ))}
        </ol>
      ) : (
        <div className="mt-4">
          <AdminEmptyState
            title="Sin productos completados"
            description="Todavía no existen órdenes completadas con productos en el período seleccionado."
            icon={<PackageSearch className="h-5 w-5" strokeWidth={2} aria-hidden="true" />}
          />
        </div>
      )}
    </section>
  );
}
