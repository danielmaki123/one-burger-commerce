"use client";

import { formatPickupAddress, type PickupLocation } from "@/modules/locations/domain/location-rules";
import {
  PAYMENT_METHOD_LABELS,
  type OrderPaymentMethod,
} from "@/modules/orders/domain/order.types";
import { useBusinessSettings } from "@/shared/lib/business-settings";
import { buildCustomerTicketLines } from "@/shared/lib/customer-ticket";
import { printLines } from "@/shared/lib/print-lines";
import { Button } from "@/shared/ui/button";

/**
 * Bloque 10.4 del roadmap del POS (Fase 2) — **reimprimir** el ticket de cliente.
 *
 * Desde el detalle del pedido, con los datos que la pantalla ya cargó (ítems, totales, cobros y punto de
 * retiro). El texto sale de `buildCustomerTicketLines` (función pura y probada): la misma hoja que se
 * imprime al cobrar en el mostrador — reimprimir tiene que sacar el mismo papel, no una versión parecida.
 *
 * Los importes llegan **ya resueltos** del servidor: acá no se recalcula nada. Dos datos que el detalle
 * **no** tiene no se inventan: el **vuelto** (la venta de mostrador ya lo entregó y el pedido no lo
 * guarda) y el **precio unitario** de cada ítem (el `lineTotal` incluye empaque y modificadores, así que
 * dividirlo daría un número falso): sin precio unitario el ticket muestra el total de la línea.
 */
export type OrderTicketButtonOrder = {
  orderNumber: string;
  customerName: string;
  createdAt: string;
  items: {
    productName: string;
    quantity: number;
    lineTotal: number;
    notes: string | null;
    modifiers: { name: string; priceDelta: number }[];
  }[];
  subtotal: number;
  discount: number;
  packagingAmount: number;
  tipAmount: number;
  total: number;
  payments?: { method: OrderPaymentMethod; amount: number; currency: string | null }[];
  pickupTime?: string | null;
  pickupScheduled?: boolean;
  pickupLocation?: PickupLocation | null;
};

export default function OrderTicketButton({ order }: { order: OrderTicketButtonOrder }) {
  const settings = useBusinessSettings();

  function reprint() {
    printLines(
      buildCustomerTicketLines(
        {
          orderNumber: order.orderNumber,
          customerName: order.customerName,
          createdAt: order.createdAt,
          items: order.items.map((item) => ({
            name: item.productName,
            quantity: item.quantity,
            unitPrice: null,
            lineTotal: item.lineTotal,
            notes: item.notes,
            modifiers: item.modifiers.map((modifier) => ({
              name: modifier.name,
              priceDelta: modifier.priceDelta,
            })),
          })),
          subtotal: order.subtotal,
          discount: order.discount,
          packagingAmount: order.packagingAmount,
          tipAmount: order.tipAmount,
          total: order.total,
          payments: (order.payments ?? []).map((payment) => ({
            methodLabel: PAYMENT_METHOD_LABELS[payment.method],
            amount: payment.amount,
            currency: payment.currency,
          })),
          change: null,
          pickupLocationName: order.pickupLocation?.name ?? null,
          pickupAddress: formatPickupAddress(order.pickupLocation ?? null) || null,
          pickupTime: order.pickupTime ?? null,
          pickupScheduled: Boolean(order.pickupScheduled),
          notes: null,
        },
        {
          businessName: settings.name,
          timezone: settings.timezone,
          locale: settings.locale,
          currencyCode: settings.currencyCode,
          currencySymbol: settings.currencySymbol,
        },
      ),
    );
  }

  return (
    <Button type="button" variant="outline" className="min-h-11" onClick={reprint}>
      Reimprimir ticket
    </Button>
  );
}
