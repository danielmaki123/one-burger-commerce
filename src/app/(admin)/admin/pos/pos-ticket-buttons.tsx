"use client";

import { buildCustomerTicketLines } from "@/shared/lib/customer-ticket";
import { buildKitchenTicketLines } from "@/shared/lib/kitchen-ticket";
import { printLines } from "@/shared/lib/print-lines";
import { Button } from "@/shared/ui/button";
import { useBusinessSettings } from "@/shared/lib/business-settings";

/**
 * Bloque 10.1/10.2 del roadmap del POS (Fase 2) — los dos papeles de una venta de mostrador.
 *
 * Salen de los mismos datos de la venta que ya están en pantalla, y son **opuestos a propósito**: el de
 * cocina no lleva importes (la cocina necesita qué preparar y para cuándo) y el del cliente es el
 * comprobante (precios, total y con qué pagó). Los textos salen de funciones puras y probadas
 * (`buildKitchenTicketLines`, `buildCustomerTicketLines`) y acá solo se imprimen con `printLines`
 * (ventana nueva + `print()`, sin dependencias ni impresora de red).
 *
 * Vive en su propio archivo porque el `pos-client.tsx` es deuda con techo congelado: no puede crecer.
 */
export type PosTicketSale = {
  orderNumber: string;
  total: number;
  change: number | null;
  /** Cuándo se cobró: es la hora que llevan los dos papeles, no la de la impresión. */
  chargedAt: string;
  receipt: {
    customerName: string;
    lines: { name: string; quantity: number; unitPrice: number; lineTotal: number }[];
    subtotal: number;
    packagingAmount: number;
    payments: { methodLabel: string; amount: number; currency: string | null }[];
  };
};

export default function PosTicketButtons({ sale }: { sale: PosTicketSale }) {
  const settings = useBusinessSettings();
  const options = {
    businessName: settings.name,
    timezone: settings.timezone,
    locale: settings.locale,
    currencyCode: settings.currencyCode,
    currencySymbol: settings.currencySymbol,
  };

  function printKitchenTicket() {
    printLines(
      buildKitchenTicketLines(
        {
          orderNumber: sale.orderNumber,
          pickupTime: sale.chargedAt,
          // El POS arma una venta "lo antes posible", que es lo que el servidor resolvió al crear.
          pickupScheduled: false,
          pickupNotes: null,
          notes: null,
          items: sale.receipt.lines.map((line) => ({
            name: line.name,
            quantity: line.quantity,
            notes: null,
            modifiers: [],
          })),
        },
        { ...options, label: "COCINA" },
      ),
    );
  }

  function printCustomerTicket() {
    printLines(
      buildCustomerTicketLines(
        {
          orderNumber: sale.orderNumber,
          customerName: sale.receipt.customerName,
          createdAt: sale.chargedAt,
          items: sale.receipt.lines.map((line) => ({
            name: line.name,
            quantity: line.quantity,
            unitPrice: line.unitPrice,
            lineTotal: line.lineTotal,
            notes: null,
            modifiers: [],
          })),
          subtotal: sale.receipt.subtotal,
          discount: 0,
          packagingAmount: sale.receipt.packagingAmount,
          tipAmount: 0,
          total: sale.total,
          payments: sale.receipt.payments,
          change: sale.change,
          pickupLocationName: null,
          pickupAddress: null,
          pickupTime: sale.chargedAt,
          pickupScheduled: false,
          notes: null,
        },
        options,
      ),
    );
  }

  return (
    <>
      <Button type="button" variant="outline" className="min-h-11" onClick={printKitchenTicket}>
        Ticket de cocina
      </Button>
      <Button type="button" variant="outline" className="min-h-11" onClick={printCustomerTicket}>
        Ticket de cliente
      </Button>
    </>
  );
}
