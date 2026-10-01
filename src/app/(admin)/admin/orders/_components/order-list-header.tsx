"use client";

import { RotateCw } from "lucide-react";

import { Button } from "@/shared/ui/button";

import type { OrderListKpi } from "../order-list-types";

/**
 * `TASK-ORDERS-RUNTIME-5B` — **la cabecera del listado**: título, contexto de sucursal, los **cuatro KPI** y
 * el botón de actualizar.
 *
 * Sigue la referencia aprobada: una línea compacta en escritorio, y los KPI **clicables** —tocarlos aplica el
 * filtro que describen, que es lo que la referencia hace—. Los números van en `font-mono tabular-nums`.
 *
 * Los KPI llegan **del servidor** y describen el **filtro completo**, no la página: la cabecera y la tabla no
 * pueden discrepar, y cambiar de página no cambia un número.
 */
export function OrderListHeader({
  contextLabel,
  kpi,
  loading,
  onRefresh,
  onApplyFilter,
}: {
  contextLabel: string;
  kpi: OrderListKpi;
  loading: boolean;
  onRefresh: () => void;
  onApplyFilter: (filter: "active" | "pendingPayment" | "scheduled") => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1">
      <div className="flex min-w-0 items-baseline gap-2">
        <h1 className="font-heading text-st-h2 font-bold uppercase tracking-tight text-ink">Pedidos</h1>
        <span className="truncate text-st-caption font-semibold text-ink-secondary">{contextLabel}</span>
      </div>

      <p
        className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-st-caption font-semibold text-ink-secondary"
        aria-label="Resumen de pedidos"
        data-testid="orders-kpi"
      >
        <span>
          <strong className="font-mono tabular-nums text-ink" data-testid="orders-kpi-total">
            {kpi.total}
          </strong>{" "}
          {kpi.total === 1 ? "pedido" : "pedidos"}
        </span>
        <span aria-hidden="true">·</span>
        <KpiLink label="activas" value={kpi.active} testId="orders-kpi-active" onClick={() => onApplyFilter("active")} />
        <span aria-hidden="true">·</span>
        <KpiLink
          label="pendientes de pago"
          value={kpi.pendingPayment}
          testId="orders-kpi-pending"
          onClick={() => onApplyFilter("pendingPayment")}
        />
        <span aria-hidden="true">·</span>
        <KpiLink
          label="programadas"
          value={kpi.scheduled}
          testId="orders-kpi-scheduled"
          onClick={() => onApplyFilter("scheduled")}
        />
      </p>

      <Button
        variant="outline"
        size="icon"
        className="ml-auto"
        aria-label="Actualizar"
        title="Actualizar"
        onClick={onRefresh}
        disabled={loading}
      >
        <RotateCw aria-hidden="true" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
      </Button>
    </div>
  );
}

/**
 * Un KPI clicable: **hace** algo —aplica el filtro que describe el número—, así que es un `Button` primitivo
 * en su variante `ghost` (sin relleno: la anatomía de un número con su etiqueta). El `aria-label` incluye el
 * número para que el lector de pantalla no lea «activas» suelto.
 */
function KpiLink({
  label,
  value,
  testId,
  onClick,
}: {
  label: string;
  value: number;
  testId: string;
  onClick: () => void;
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={onClick}
      aria-label={`Filtrar por ${label}: ${value}`}
      data-testid={testId}
      className="gap-1 px-1 font-semibold text-ink-secondary hover:text-brand-primary"
    >
      <span className="font-mono tabular-nums text-ink">{value}</span> {label}
    </Button>
  );
}
