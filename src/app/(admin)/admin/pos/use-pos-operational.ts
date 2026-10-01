"use client";

import * as React from "react";

import type { PosOperationalFeed } from "@/modules/orders/domain/pos-operational-orders";

import type { PosOperationalMode } from "./pos-operational-band";

/**
 * `TASK-ORDER-POS-OPERATIONAL-006` (brief §8, §10) — **el estado del trabajo operacional del POS**.
 *
 * Carga el feed del servidor (`PosOperationalOrdersProjection` + su resumen) y guarda **qué panel está
 * abierto** y **qué pedido se está cobrando**. Vivir en un hook y no en la pantalla tiene dos razones:
 *
 * 1. `pos-client.tsx` es deuda con techo congelado: no puede crecer. La responsabilidad tiene su propia API.
 * 2. **El resumen no se calcula acá.** `summary` llega del servidor; este hook sólo lo guarda. Contar las filas
 *    visibles —o agregar cuatro requests en React— es exactamente lo que el brief §10 prohíbe, y tenerlo en un
 *    hook con nombre propio hace visible que la regla no vive en la pantalla.
 *
 * El pedido abierto se carga por **id** contra el detalle que ya existe: no se inventa una segunda lectura ni
 * se reusa la fila del feed como si fuera el pedido completo (el feed es mínimo a propósito, brief §11).
 */

/** El pedido existente que el cajero está por cobrar o entregar, como lo devuelve la API del detalle. */
export type PosExistingOrder = {
  id: string;
  orderNumber: string;
  customerName: string;
  source: "menu" | "pos" | null;
  status: string;
  pickupTime: string | null;
  pickupScheduled: boolean;
  currencyCode: string | null;
  total: number;
  financial: {
    status: "pending" | "partial" | "paid";
    paidAmount: number;
    outstandingAmount: number;
    unresolvedAmount: number;
    baseCurrencyCode: string;
  } | null;
};

/** El detalle del pedido, reducido a lo que el POS necesita. Ni items, ni historial, ni factura (brief §11). */
export function toPosExistingOrder(detail: {
  id: string;
  orderNumber: string;
  customer: { name: string };
  source: "menu" | "pos" | null;
  status: string;
  pickup: { time: string | null; scheduled: boolean };
  currencyCode: string | null;
  totals: { total: number } | null;
  financial: {
    status: "pending" | "partial" | "paid";
    paidAmount: number;
    outstandingAmount: number;
    unresolvedAmount: number;
    baseCurrencyCode: string;
  } | null;
}): PosExistingOrder {
  return {
    id: detail.id,
    orderNumber: detail.orderNumber,
    customerName: detail.customer.name,
    source: detail.source,
    status: detail.status,
    pickupTime: detail.pickup.time,
    pickupScheduled: detail.pickup.scheduled,
    currencyCode: detail.currencyCode,
    // Sin capacidad financiera el total no viaja: se informa 0 y el pedido se trata como no liquidable.
    total: detail.totals?.total ?? 0,
    financial: detail.financial,
  };
}

export type UsePosOperationalParams = {
  locationId: string;
  /** El pedido que llegó por URL (`?orderId=`), si lo hay. */
  initialOrderId?: string | null;
  /** El intervalo del refresco de fondo (el mismo del catálogo). */
  refreshMs: number;
};

export function usePosOperational({
  locationId,
  initialOrderId = null,
  refreshMs,
}: UsePosOperationalParams) {
  const [feed, setFeed] = React.useState<PosOperationalFeed | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [reloadKey, setReloadKey] = React.useState(0);
  const [mode, setMode] = React.useState<PosOperationalMode | null>(null);
  const [orderId, setOrderId] = React.useState<string | null>(initialOrderId);
  const [order, setOrder] = React.useState<PosExistingOrder | null>(null);
  const [orderLoading, setOrderLoading] = React.useState(false);
  const [orderError, setOrderError] = React.useState<string | null>(null);
  const locationRef = React.useRef(locationId);

  const loadFeed = React.useCallback(
    async (targetLocationId: string, options: { silent?: boolean } = {}) => {
      if (targetLocationId === "") {
        setLoading(false);
        return;
      }

      if (!options.silent) {
        setLoading(true);
        setError(null);
      }

      try {
        const response = await fetch(
          `/api/admin/pos/operational-orders?locationId=${encodeURIComponent(targetLocationId)}`,
        );
        if (!response.ok) throw new Error("No se pudieron leer los pedidos del local.");

        const body = (await response.json()) as { data: PosOperationalFeed };
        // Una respuesta de un local que el cajero ya dejó no pisa la del actual.
        if (locationRef.current !== targetLocationId) return;

        setFeed(body.data);
      } catch (caught) {
        if (options.silent) return;

        setFeed(null);
        setError(
          caught instanceof Error ? caught.message : "No se pudieron leer los pedidos del local.",
        );
      } finally {
        if (!options.silent) setLoading(false);
      }
    },
    [],
  );

  React.useEffect(() => {
    locationRef.current = locationId;
    setMode(null);
    void loadFeed(locationId);
  }, [locationId, reloadKey, loadFeed]);

  /**
   * El refresco de fondo no toca el panel abierto ni la búsqueda: lo que el cajero está mirando queda donde
   * está, igual que el borrador de la venta rápida.
   */
  React.useEffect(() => {
    if (locationId === "") return;

    const timer = setInterval(() => void loadFeed(locationId, { silent: true }), refreshMs);

    return () => clearInterval(timer);
  }, [locationId, loadFeed, refreshMs]);

  /**
   * El detalle del pedido abierto, contra la API que ya existe (`GET /api/admin/orders/[id]`). Se pide sólo
   * cuando hay un pedido abierto: el feed no trae lo que el checkout necesita (el saldo lo trae, pero el
   * cierre del cobro tiene que leer el hecho canónico y no una fila que puede tener segundos).
   */
  const loadOrder = React.useCallback(async (targetOrderId: string) => {
    setOrderLoading(true);
    setOrderError(null);

    try {
      const response = await fetch(`/api/admin/orders/${encodeURIComponent(targetOrderId)}`);
      if (!response.ok) {
        throw new Error(
          response.status === 404
            ? "Ese pedido no existe o no es de tu sucursal."
            : "No se pudo abrir el pedido.",
        );
      }

      const body = (await response.json()) as { data: Parameters<typeof toPosExistingOrder>[0] };
      setOrder(toPosExistingOrder(body.data));
    } catch (caught) {
      setOrder(null);
      setOrderError(caught instanceof Error ? caught.message : "No se pudo abrir el pedido.");
    } finally {
      setOrderLoading(false);
    }
  }, []);

  React.useEffect(() => {
    if (orderId === null) {
      setOrder(null);
      return;
    }

    void loadOrder(orderId);
  }, [orderId, loadOrder]);

  return {
    feed,
    loading,
    error,
    /** El modo del panel operacional abierto; `null` = cerrado. */
    mode,
    setMode,
    /** Reintenta la lectura del feed (el botón del estado de error). */
    retry: () => setReloadKey((key) => key + 1),
    refresh: () => loadFeed(locationId, { silent: true }),
    openPanel: (nextMode: PosOperationalMode) =>
      setMode((current) => (current === nextMode ? null : nextMode)),
    closePanel: () => setMode(null),
    /** El pedido existente abierto (por los KPI o por `?orderId=`), con su detalle. */
    order,
    orderLoading,
    orderError,
    openOrder: (nextOrderId: string) => setOrderId(nextOrderId),
    closeOrder: () => setOrderId(null),
    /** Relee el detalle después de cobrar o entregar: el saldo lo dice `payments`, no la pantalla. */
    reloadOrder: () => (orderId === null ? Promise.resolve() : loadOrder(orderId)),
    /** Relee el feed: cobrar o entregar cambia los cuatro contadores. */
    reloadFeed: () => loadFeed(locationId, { silent: true }),
  };
}
