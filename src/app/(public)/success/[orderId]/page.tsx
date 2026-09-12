"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/shared/ui/button";
import {
  formatPickupAddress,
  type PickupLocation,
} from "@/modules/locations/domain/location-rules";
import { readDeviceOrders, upsertDeviceOrder } from "@/shared/lib/device-orders";
import OrderSuccessView from "./order-success-view";

type OrderModifier = {
  id: string;
  modifierOptionId: string;
  name: string;
  priceDelta: number;
};

type OrderItem = {
  id: string;
  productId: string;
  productName: string;
  quantity: number;
  unitPrice: number;
  packagingUnitAmount: number;
  packagingQuantity: number;
  packagingTotalAmount: number;
  lineTotal: number;
  notes?: string | null;
  modifiers: OrderModifier[];
};

type OrderPayload = {
  data: {
    id: string;
    orderNumber: string;
    type: string;
    status: string;
    total: number;
    subtotal: number;
    discount: number;
    packagingAmount: number;
    deliveryFeeAmount: number;
    tipAmount: number;
    tipRate?: number | null;
    deliveryFeeStatus?: string | null;
    customerName: string;
    items: OrderItem[];
    createdAt: string;
    updatedAt?: string;
    pickupTime?: string | null;
    /** Si el cliente programó el retiro; sin programar es "lo antes posible". */
    pickupScheduled?: boolean;
    /** PIN de retiro para dictar en caja (T13). */
    pickupPin?: string | null;
    /** Dónde retira (T8 fase 7); `null` si el local ya no existe. */
    pickupLocation?: PickupLocation | null;
  };
};

function formatPublicOrderStatus(status: string): string {
  const normalized = status.toLowerCase();
  if (normalized === "new") return "Recibida";
  if (normalized === "confirmed") return "Confirmada";
  if (normalized === "preparing") return "En preparación";
  if (normalized === "ready") return "Lista";
  if (normalized === "ready_for_pickup") return "Lista para retirar";
  if (normalized === "picked_up") return "Retirada";
  if (normalized === "out_for_delivery") return "En camino";
  if (normalized === "delivered") return "Entregada";
  if (normalized === "accepted") return "Aceptada";
  if (normalized === "served") return "Servida";
  if (normalized === "closed") return "Completada";
  if (normalized === "cancelled") return "Cancelada";
  return status;
}

export default function OrderSuccessPage() {
  const params = useParams<{ orderId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [order, setOrder] = useState<OrderPayload["data"] | null>(null);

  const orderId = useMemo(() => String(params.orderId || ""), [params.orderId]);
  const orderLookupToken = useMemo(
    () => searchParams.get("token") ?? "",
    [searchParams],
  );

  useEffect(() => {
    async function fetchOrder() {
      setLoading(true);
      setError(null);

      try {
        if (!orderLookupToken) {
          setError(
            "No se pudo verificar tu pedido. Usa el enlace completo de confirmación o consulta el estado en 'Mi actividad'.",
          );
          setLoading(false);
          return;
        }

        const res = await fetch(
          `/api/orders/${orderId}?token=${encodeURIComponent(orderLookupToken)}`,
          {
            cache: "no-store",
          },
        );
        if (res.ok) {
          const result = (await res.json()) as OrderPayload;
          setOrder(result.data);
        } else if (res.status === 401) {
          setError(
            "El enlace de confirmación no es válido o expiró. Consulta el estado en 'Mi actividad'.",
          );
        } else if (res.status === 404) {
          setError("La orden no existe o fue eliminada.");
        } else {
          setError("No se pudo cargar la orden.");
        }
      } catch {
        setError("No se pudo cargar la orden.");
      } finally {
        setLoading(false);
      }
    }

    if (!orderId) {
      setLoading(false);
      setError("Order ID inválido.");
      return;
    }

    void fetchOrder();
  }, [orderId, orderLookupToken]);

  useEffect(() => {
    if (!order) return;
    const existing = readDeviceOrders().orders.find(
      (storedOrder) => storedOrder.orderNumber === order.orderNumber,
    );
    upsertDeviceOrder({
      orderNumber: order.orderNumber,
      type: order.type === "table" ? "table" : order.type === "pickup" ? "pickup" : "delivery",
      status: order.status,
      statusLabel: formatPublicOrderStatus(order.status),
      updatedAt: order.updatedAt ?? order.createdAt,
      subtotal: order.subtotal,
      discount: order.discount,
      packagingAmount: order.packagingAmount,
      deliveryFeeAmount: order.deliveryFeeAmount,
      tipAmount: order.tipAmount,
      tipRate: order.tipRate ?? null,
      createdAt: order.createdAt,
      total: order.total,
      lastCheckedAt: new Date().toISOString(),
      stale: false,
      orderLookupToken: orderLookupToken || existing?.orderLookupToken,
      // T7: con las líneas guardadas, el historial puede repetir el pedido; con
      // la hora de retiro, puede mostrar el estimado.
      pickupTime: order.pickupTime ?? null,
      pickupScheduled: order.pickupScheduled ?? false,
      // El PIN se guarda con el pedido del dispositivo (T13): el cliente lo
      // necesita al retirar y no siempre tiene el link a mano.
      pickupPin: order.pickupPin ?? null,
      // El local de retiro (T8 fase 7) también: el historial se lee sin red y ahí es
      // donde el cliente busca dónde iba a retirar.
      locationName: order.pickupLocation?.name ?? null,
      locationAddress: formatPickupAddress(order.pickupLocation ?? null),
      locationMapsUrl: order.pickupLocation?.mapsUrl ?? null,
      items: order.items.map((item) => ({
        productId: item.productId,
        productName: item.productName,
        quantity: item.quantity,
        unitPrice: item.unitPrice,
        packagingUnitAmount: item.packagingUnitAmount,
        modifierOptionIds: item.modifiers.map((modifier) => modifier.modifierOptionId),
        modifiers: item.modifiers.map((modifier) => ({
          groupName: "",
          optionName: modifier.name,
          priceDelta: modifier.priceDelta,
        })),
        notes: item.notes ?? undefined,
        lineTotal: item.lineTotal,
      })),
    });
  }, [order, orderLookupToken]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-brand" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <h1 className="text-2xl font-bold text-foreground">No pudimos cargar la confirmación</h1>
        <p className="text-sm text-muted-foreground">{error}</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => router.push("/menu")}>
            Volver al menú
          </Button>
          <Button onClick={() => router.push("/")}>Ir al inicio</Button>
        </div>
      </div>
    );
  }

  if (!order) {
    return null;
  }

  return (
    <OrderSuccessView
      order={order}
      onViewActivity={() => router.push("/activity?tab=orders")}
      onOrderAgain={() => router.push("/menu")}
    />
  );
}

