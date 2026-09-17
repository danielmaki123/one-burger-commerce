import { formatCurrency } from "@/shared/lib/format-currency";
import { formatShiftDateTime } from "@/shared/lib/shift-datetime";

/**
 * Bloque 10.2/10.4 del roadmap del POS (Fase 2) — el **ticket de cliente**, en texto plano.
 *
 * Es el papel que se lleva el cliente, y es el hermano opuesto del ticket de cocina (Bloque 10.1): la
 * cocina necesita **qué** preparar y para cuándo —sin importes—, el cliente necesita el comprobante con
 * precios, total y con qué pagó. Se imprime al cobrar en el mostrador (10.2) y se **reimprime** después
 * desde el detalle del pedido (10.4), así que el texto sale de una función pura: la misma hoja para los
 * dos caminos, probable sin navegador.
 *
 * Los importes **no se recalculan acá**: llegan resueltos por la pantalla, que usa las mismas fuentes
 * (`order-totals.ts` para los totales y los cobros registrados para el pago). Lo que sí decide este
 * módulo es cómo se dice: una línea que está en cero no se imprime (un descuento de `C$0.00` es ruido en
 * un papel de 8 cm), una moneda distinta a la del negocio se muestra con **su** código y un pedido sin
 * cobros dice que se paga al retirar.
 */

export type CustomerTicketItem = {
  name: string;
  quantity: number;
  /**
   * Precio unitario, ya resuelto. Se imprime solo cuando no es obvio (cantidad > 1) y cuando existe: la
   * reimpresión desde el detalle del pedido no lo tiene —el `lineTotal` incluye empaque y modificadores,
   * así que dividirlo daría un número falso— y entonces no se imprime.
   */
  unitPrice: number | null;
  lineTotal: number;
  notes: string | null;
  modifiers: { name: string; priceDelta: number }[];
};

export type CustomerTicketPayment = {
  methodLabel: string;
  amount: number;
  /** `null` o la moneda del negocio se imprimen con su símbolo; otra, con su código. */
  currency: string | null;
};

export type CustomerTicketOrder = {
  orderNumber: string;
  customerName: string;
  createdAt: string;
  items: CustomerTicketItem[];
  subtotal: number;
  discount: number;
  packagingAmount: number;
  tipAmount: number;
  total: number;
  /** Cobros registrados. Vacío = pedido del checkout, que se paga al retirar. */
  payments: CustomerTicketPayment[];
  /** Vuelto entregado, cuando sobró. `null` o `0` no se imprimen. */
  change: number | null;
  pickupLocationName: string | null;
  pickupAddress: string | null;
  pickupTime: string | null;
  /** `true` = el cliente eligió una hora; `false` = lo antes posible. */
  pickupScheduled: boolean;
  notes: string | null;
};

export type CustomerTicketOptions = {
  businessName: string;
  timezone: string;
  locale: string;
  currencyCode: string;
  currencySymbol: string;
};

function money(amount: number, currency: string | null, options: CustomerTicketOptions): string {
  const isBusinessCurrency =
    currency === null || currency.toUpperCase() === options.currencyCode.toUpperCase();

  if (isBusinessCurrency) {
    return formatCurrency(amount, { symbol: options.currencySymbol, locale: options.locale });
  }

  return formatCurrency(amount, {
    symbol: `${currency.toUpperCase()} `,
    locale: options.locale,
  });
}

/** Los ítems del pedido, con sus modificadores y notas. */
export function buildCustomerTicketItemLines(
  order: CustomerTicketOrder,
  options: CustomerTicketOptions,
): string[] {
  const lines: string[] = [];

  for (const item of order.items) {
    lines.push(
      `${item.quantity} x ${item.name}  ${money(item.lineTotal, null, options)}`,
    );

    if (item.quantity > 1 && item.unitPrice !== null) {
      lines.push(`   ${money(item.unitPrice, null, options)} c/u`);
    }

    for (const modifier of item.modifiers) {
      lines.push(
        `   + ${modifier.name}${
          modifier.priceDelta > 0 ? ` (${money(modifier.priceDelta, null, options)})` : ""
        }`,
      );
    }

    if (item.notes?.trim()) lines.push(`   ! ${item.notes.trim()}`);
  }

  return lines;
}

/** El detalle de importes: solo lo que no está en cero, más el total. */
export function buildCustomerTicketTotalLines(
  order: CustomerTicketOrder,
  options: CustomerTicketOptions,
): string[] {
  const lines = [`Subtotal ${money(order.subtotal, null, options)}`];

  if (order.discount > 0) {
    lines.push(`Descuento -${money(order.discount, null, options)}`);
  }

  if (order.packagingAmount > 0) {
    lines.push(`Empaque ${money(order.packagingAmount, null, options)}`);
  }

  if (order.tipAmount > 0) {
    lines.push(`Propina ${money(order.tipAmount, null, options)}`);
  }

  lines.push(`Total ${money(order.total, null, options)}`);

  return lines;
}

/** Cómo pagó: cada cobro con su medio, el vuelto si hubo, o el aviso de que se paga al retirar. */
export function buildCustomerTicketPaymentLines(
  order: CustomerTicketOrder,
  options: CustomerTicketOptions,
): string[] {
  if (order.payments.length === 0) return ["Se paga al retirar en el local."];

  const lines = order.payments.map(
    (payment) =>
      `${payment.methodLabel} ${money(payment.amount, payment.currency, options)}`,
  );

  if (order.change !== null && order.change > 0) {
    lines.push(`Cambio ${money(order.change, null, options)}`);
  }

  return lines;
}

/** Dónde y cuándo se retira. Sin local resuelto no se inventa el punto de retiro. */
export function buildCustomerTicketPickupLines(
  order: CustomerTicketOrder,
  options: CustomerTicketOptions,
): string[] {
  const lines: string[] = [];

  if (order.pickupLocationName?.trim()) {
    lines.push(`Retiro en ${order.pickupLocationName.trim()}`);
  }

  if (order.pickupAddress?.trim()) {
    lines.push(order.pickupAddress.trim());
  }

  const when =
    order.pickupScheduled && order.pickupTime
      ? formatShiftDateTime(order.pickupTime, { timezone: options.timezone, locale: options.locale })
      : "lo antes posible";

  lines.push(`Retiro: ${when}`);

  return lines;
}

/** El ticket completo, línea por línea, listo para imprimir. */
export function buildCustomerTicketLines(
  order: CustomerTicketOrder,
  options: CustomerTicketOptions,
): string[] {
  const lines: string[] = [
    options.businessName.toUpperCase(),
    "TICKET DE CLIENTE",
    "",
    `Pedido ${order.orderNumber}`,
    formatShiftDateTime(order.createdAt, {
      timezone: options.timezone,
      locale: options.locale,
    }),
  ];

  if (order.customerName?.trim()) {
    lines.push(`Cliente: ${order.customerName.trim()}`);
  }

  lines.push(
    "",
    ...buildCustomerTicketItemLines(order, options),
    "",
    ...buildCustomerTicketTotalLines(order, options),
    "",
    ...buildCustomerTicketPaymentLines(order, options),
    "",
    ...buildCustomerTicketPickupLines(order, options),
  );

  if (order.notes?.trim()) {
    lines.push("", `NOTA: ${order.notes.trim()}`);
  }

  lines.push("", "Gracias por tu pedido.");

  return lines;
}
