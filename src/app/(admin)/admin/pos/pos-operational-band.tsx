"use client";

import * as React from "react";

import type {
  PosOperationalFeed,
  PosOperationalOrder,
  PosOperationalSummary,
} from "@/modules/orders/domain/pos-operational-orders";
import { Button } from "@/shared/ui/button";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §5, §21) — **la banda de KPI operacionales del encabezado**.
 *
 * Debajo de la barra de contexto (`POS · Local · Terminal · ● Caja abierta`), una banda **compacta**:
 * `En proceso 6 | Listos 4 | Por cobrar 3 | Programados 2`. Nada de cards grandes ni de textos explicativos:
 * **nombre + contador** y, en tablet y celular, chips/botones compactos con scroll **interno** al contenedor
 * (la página nunca scrollea en horizontal).
 *
 * Cada contador es un **botón** que abre el panel operacional en su modo. Es el pedido del brief §21: pulsar
 * un KPI abre **un único** panel reutilizable, no cuatro modales distintos.
 *
 * Los números **vienen del servidor** (`PosOperationalSummary`): esta pieza no cuenta nada ni conoce la regla
 * de qué es «listo» o «por cobrar». Si el feed no llegó todavía, la banda dice que está leyendo en vez de
 * mostrar ceros que parecerían un local vacío.
 */

export type PosOperationalMode = "process" | "ready" | "pending-payment" | "scheduled";

export type PosOperationalBandEntry = {
  mode: PosOperationalMode;
  label: string;
  /** El rótulo corto que se usa en el celular, donde el espacio es el recurso escaso. */
  shortLabel: string;
  value: number;
};

/**
 * Las cuatro entradas de la banda, en el orden aprobado por el brief §5.
 *
 * Los rótulos cortos existen porque a 375 px «En proceso 6 | Listos 4 | Por cobrar 3 | Programados 2» no entra
 * en una línea, y partir la banda en dos renglones la convierte en un bloque alto (brief §60). Con los cortos,
 * los cuatro entran o scrollean dentro de su contenedor sin mover la página.
 */
export function buildPosOperationalBand(summary: PosOperationalSummary): PosOperationalBandEntry[] {
  return [
    { mode: "process", label: "En proceso", shortLabel: "Proceso", value: summary.inProcess },
    { mode: "ready", label: "Listos", shortLabel: "Listos", value: summary.ready },
    { mode: "pending-payment", label: "Por cobrar", shortLabel: "Cobrar", value: summary.pendingPayment },
    { mode: "scheduled", label: "Programados", shortLabel: "Prog.", value: summary.scheduled },
  ];
}

export function PosOperationalBand({
  feed,
  loading,
  error,
  activeMode,
  onSelect,
  onRetry,
}: {
  feed: PosOperationalFeed | null;
  loading: boolean;
  error: string | null;
  /** El modo abierto en el panel, para marcar el chip activo. `null` = panel cerrado. */
  activeMode: PosOperationalMode | null;
  onSelect: (mode: PosOperationalMode) => void;
  onRetry: () => void;
}) {
  if (error) {
    return (
      <div
        role="status"
        className="flex flex-wrap items-center gap-2 rounded-stitch-md border border-status-sla-border bg-status-sla-bg px-3 py-1.5 text-st-body text-status-sla-text"
      >
        <span className="font-medium">No se pudieron leer los pedidos del local.</span>
        <Button type="button" variant="ghost" className="min-h-11" onClick={onRetry}>
          Reintentar
        </Button>
      </div>
    );
  }

  if (!feed) {
    return (
      <p role="status" className="text-st-body text-ink-secondary">
        {loading ? "Leyendo los pedidos del local…" : "Sin pedidos para mostrar."}
      </p>
    );
  }

  return (
    <nav aria-label="Resumen operacional del local" className="min-w-0">
      {/*
        El scroll horizontal vive **acá adentro**: la banda nunca empuja el ancho de la página (`min-w-0` +
        `overflow-x-auto` en el contenedor, no en el `body`). Es la regla del brief §5/§60.
      */}
      <ul className="flex min-w-0 items-center gap-1.5 overflow-x-auto pb-0.5">
        {buildPosOperationalBand(feed.summary).map((entry) => (
          <li key={entry.mode} className="shrink-0">
            {/*
              El primitivo del sistema y no un control HTML crudo: el guardrail del repo prohíbe el HTML
              crudo donde existe el componente, y el `Button` ya trae los 44 px y los estados.
            */}
            <Button
              type="button"
              data-testid={`pos-kpi-${entry.mode}`}
              aria-pressed={activeMode === entry.mode}
              aria-label={`${entry.label}: ${entry.value} pedidos`}
              variant={activeMode === entry.mode ? "primary" : "secondary"}
              className="min-h-11"
              onClick={() => onSelect(entry.mode)}
            >
              <span className="hidden sm:inline">{entry.label}</span>
              <span className="sm:hidden">{entry.shortLabel}</span>
              <span className="font-mono tabular-nums text-ink">{entry.value}</span>
            </Button>
          </li>
        ))}
      </ul>
    </nav>
  );
}

/** El subtítulo de cada modo en el panel: dice **qué** lista el cajero está mirando. */
export const POS_OPERATIONAL_MODE_TITLES: Record<PosOperationalMode, string> = {
  process: "En proceso",
  ready: "Listos para entregar",
  "pending-payment": "Por cobrar",
  scheduled: "Programados",
};

/**
 * Filtra el feed por modo. Es **presentación** sobre un feed que ya vino del servidor: la regla de qué entra
 * en cada modo vive en el dominio (`classifyPosOperational`) y acá sólo se usa su resultado.
 */
export function filterPosOperationalOrders(
  orders: readonly PosOperationalOrder[],
  mode: PosOperationalMode,
): PosOperationalOrder[] {
  return orders.filter((order) => {
    switch (mode) {
      case "process":
        return ["new", "confirmed", "preparing"].includes(order.status);
      case "ready":
        return order.status === "ready_for_pickup";
      case "pending-payment":
        return order.financialState.status !== "paid";
      default:
        return order.pickupScheduled && Boolean(order.pickupTime);
    }
  });
}

/**
 * El orden del panel en el modo `scheduled`: **por hora prometida**, no por creación (brief §6).
 *
 * El caso de uso ya devuelve el feed ordenado con los programados primero; este orden lo repite de forma
 * explícita porque el panel lo puede abrir después de filtrar y no tiene que depender de que nadie lo
 * reordene.
 */
export function sortByPickupTime(orders: readonly PosOperationalOrder[]): PosOperationalOrder[] {
  return [...orders].sort((a, b) => (a.pickupTime ?? "").localeCompare(b.pickupTime ?? ""));
}
