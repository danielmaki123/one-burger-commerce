/**
 * Bloque 10 del roadmap del POS (Fase 2) — el ticket de cocina, en texto plano.
 *
 * La cocina no cobra ni necesita precios: necesita **qué** hay que preparar, **para cuándo** y con qué
 * aclaraciones. Por eso el ticket sale de los mismos datos que la comanda del KDS (número, hora
 * prometida, líneas con modificadores y notas) y **sin importes**: un ticket con plata en la cocina es
 * ruido y, si el pedido es de mostrador, un dato que no le sirve a nadie.
 *
 * Es una función pura (texto adentro, texto afuera) para poder probarla sin navegador; el dibujo y la
 * impresión viven en el componente que la usa.
 */

export type KitchenTicketItem = {
  name: string;
  quantity: number;
  notes: string | null;
  modifiers: { name: string }[];
};

export type KitchenTicketOrder = {
  orderNumber: string;
  /** Hora prometida de retiro, en ISO. */
  pickupTime: string;
  /** `true` = el cliente eligió una hora; `false` = lo antes posible. */
  pickupScheduled: boolean;
  /** Nota del cliente sobre el retiro ("sin cebolla"). */
  pickupNotes: string | null;
  /** Nota del pedido. */
  notes: string | null;
  items: KitchenTicketItem[];
};

export type KitchenTicketOptions = {
  businessName: string;
  timezone: string;
  locale: string;
  /** Encabezado corto: `COCINA`, el nombre de la estación, lo que la cocina reconozca. */
  label: string;
};

function formatTime(iso: string, options: KitchenTicketOptions): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "—";

  return new Intl.DateTimeFormat(options.locale, {
    timeZone: options.timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

/** El encabezado: para quién es el ticket, qué pedido y para cuándo. */
export function buildKitchenTicketTitle(
  order: KitchenTicketOrder,
  options: KitchenTicketOptions,
): string[] {
  const cuando = order.pickupScheduled
    ? `RETIRO ${formatTime(order.pickupTime, options)}`
    : `LO ANTES POSIBLE (~${formatTime(order.pickupTime, options)})`;

  return [options.businessName, options.label, "", `Pedido ${order.orderNumber}`, cuando, ""];
}

/** Las líneas de preparación: cantidad, nombre, modificadores y notas de cada ítem. */
export function buildKitchenTicketLines(
  order: KitchenTicketOrder,
  options: KitchenTicketOptions,
): string[] {
  const lines: string[] = [];

  for (const item of order.items) {
    lines.push(`${item.quantity} x ${item.name}`);

    for (const modifier of item.modifiers) {
      lines.push(`  + ${modifier.name}`);
    }

    if (item.notes?.trim()) lines.push(`  ! ${item.notes.trim()}`);
  }

  const pickupNotes = order.pickupNotes?.trim();
  const orderNotes = order.notes?.trim();

  if (pickupNotes || orderNotes) {
    lines.push("");
    if (pickupNotes) lines.push(`INFO: ${pickupNotes}`);
    if (orderNotes) lines.push(`NOTA: ${orderNotes}`);
  }

  const title = buildKitchenTicketTitle(order, options);

  return [...title, ...lines];
}
