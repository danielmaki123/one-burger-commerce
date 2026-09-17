import { formatCurrency } from "@/shared/lib/format-currency";
import { formatShiftDateTime } from "@/shared/lib/shift-datetime";

import type { TelegramEvent } from "./telegram-events";

/**
 * Parte 3 del brief (alertas Telegram) — el **texto** de cada alerta al grupo del negocio.
 *
 * Es el recordatorio extra del dueño, no la app: tiene que entrar en una notificación de teléfono y decir
 * tres cosas —qué pasó, con cuánta plata y qué conviene hacer—. Por eso son funciones puras y con
 * formato cerrado: acá no se decide si se manda (eso es la configuración y el outbox) ni cómo se manda
 * (eso es el gateway).
 *
 * Las alertas usan el formato HTML de Telegram (`<b>`, `<i>`), que es el que el gateway manda.
 */

export type TelegramAlertFormat = {
  businessName: string;
  currencySymbol: string;
  timezone: string;
  locale: string;
};

function money(amount: number, options: TelegramAlertFormat): string {
  return formatCurrency(amount, { symbol: options.currencySymbol, locale: options.locale });
}

/** `-C$100.00` con el signo, porque una diferencia puede faltar o sobrar. */
function signed(amount: number, options: TelegramAlertFormat): string {
  return `${amount > 0 ? "+" : amount < 0 ? "-" : ""}${money(Math.abs(amount), options)}`;
}

function header(options: TelegramAlertFormat, title: string): string {
  return `<b>${options.businessName}</b>\n<b>${title}</b>`;
}

/** La línea que separa bloques en el mensaje de cierre (formato que fijó el owner). */
const SEPARATOR = "━━━━━━━━━━━━━━━";

/** 3.7 — una devolución supera el monto que el owner quiere revisar. */
export function buildRefundOverThresholdText(
  input: { orderNumber: string; amount: number; threshold: number; reason: string | null },
  options: TelegramAlertFormat,
): string {
  const lines = [
    header(options, "Devolución grande"),
    `Pedido ${input.orderNumber}`,
    `Monto: ${money(input.amount, options)} (umbral ${money(input.threshold, options)})`,
  ];

  if (input.reason?.trim()) lines.push(`Motivo: ${input.reason.trim()}`);
  lines.push("", "Revisá la devolución en /admin/approvals.");

  return lines.join("\n");
}

/**
 * Decisión del owner (2026-09-17) — el cierre de **cada** turno, con su sucursal.
 *
 * El grupo es uno solo para todas las sucursales, así que el mensaje dice de dónde viene en la primera
 * línea. El **formato lo fijó el owner**: sucursal, quién cerró, el turno con su duración, cuántos pedidos,
 * el desglose por medio, el total, las propinas y la diferencia. Una caja que cuadra dice «cuadra»; una con
 * diferencia la **destaca** en su propia línea, con el motivo que escribió el cajero al cerrar. Es **un
 * mensaje por cierre**: la diferencia no manda un segundo aviso.
 */
export function buildShiftClosedText(
  input: {
    locationName: string;
    openedAt: string;
    closedAt: string;
    /** Nombre de quien cierra. `null` = no se pudo resolver: se imprime «—». */
    closedByName: string | null;
    ordersCount: number;
    cash: number;
    card: number;
    transfer: number;
    total: number;
    tips: number;
    difference: number;
    /** Motivo que escribió el cajero al cerrar (opcional). */
    reason: string | null;
  },
  options: TelegramAlertFormat,
): string {
  const format = { timezone: options.timezone, locale: options.locale };
  const lines = [
    `<b>Cierre de caja — ${input.locationName}</b>`,
    "",
    `👤 Cerrado por: ${input.closedByName?.trim() || "—"}`,
    `🕐 Turno: ${formatShiftTime(input.openedAt, format)} → ${formatShiftTime(input.closedAt, format)} (${formatShiftDuration(input.openedAt, input.closedAt)})`,
    `📊 ${input.ordersCount} ${input.ordersCount === 1 ? "pedido" : "pedidos"}`,
    "",
    `💵 Efectivo: ${money(input.cash, options)}`,
    `💳 Tarjeta: ${money(input.card, options)}`,
    `🏦 Transferencia: ${money(input.transfer, options)}`,
    SEPARATOR,
    `📈 Total: ${money(input.total, options)}`,
    SEPARATOR,
    "",
    `💰 Propinas: ${money(input.tips, options)}`,
    SEPARATOR,
  ];

  if (input.difference === 0) {
    lines.push(`✅ Diferencia: ${money(0, options)} (cuadra)`);
    return lines.join("\n");
  }

  lines.push(`⚠️ DIFERENCIA: ${signed(input.difference, options)}`);
  if (input.reason?.trim()) lines.push(`📝 Motivo: "${input.reason.trim()}"`);

  return lines.join("\n");
}

/** La hora del negocio, sin la fecha: en un turno del día alcanza y el mensaje entra en el teléfono. */
function formatShiftTime(iso: string, format: { timezone: string; locale: string }): string {
  return new Intl.DateTimeFormat(format.locale, {
    timeZone: format.timezone,
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso));
}

/** Cuánto duró el turno, en `3 h 20 min` / `45 min` (los minutos se redondean). */
function formatShiftDuration(openedAt: string, closedAt: string): string {
  const minutes = Math.max(
    0,
    Math.round((new Date(closedAt).getTime() - new Date(openedAt).getTime()) / 60_000),
  );
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  if (hours === 0) return `${rest} min`;

  return rest === 0 ? `${hours} h` : `${hours} h ${rest} min`;
}

/** 1.8 — una caja quedó abierta más de un día (nadie la cerró). */
export function buildShiftOpenTooLongText(
  input: { locationName: string; openedAt: string; hoursOpen: number },
  options: TelegramAlertFormat,
): string {
  return [
    header(options, "Caja sin cerrar"),
    input.locationName,
    `Abierta hace ${Math.floor(input.hoursOpen)} h (desde ${formatShiftDateTime(input.openedAt, {
      timezone: options.timezone,
      locale: options.locale,
    })})`,
    "",
    "Se cierra desde /admin/pos.",
  ].join("\n");
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

/**
 * El texto de una alerta, a partir del evento y de su payload guardado en el outbox.
 *
 * Devuelve `null` cuando el payload no tiene la forma esperada (un evento viejo o escrito a mano): el
 * envío se saltea en vez de mandar un mensaje con `undefined` adentro. El payload lo arma el caso de uso
 * que registra el evento, así que esto es la red de seguridad, no la validación principal.
 */
export function buildTelegramAlertText(
  event: TelegramEvent,
  payload: unknown,
  options: TelegramAlertFormat,
): string | null {
  if (!isRecord(payload)) return null;

  const number = (key: string) => (typeof payload[key] === "number" ? payload[key] : null);
  const text = (key: string) => (typeof payload[key] === "string" ? payload[key] : null);

  if (event === "shift_closed") {
    const locationName = text("locationName");
    const openedAt = text("openedAt");
    const closedAt = text("closedAt");
    const ordersCount = number("ordersCount");
    const cash = number("cash");
    const card = number("card");
    const transfer = number("transfer");
    const total = number("total");
    const tips = number("tips");
    const difference = number("difference");
    if (
      !locationName ||
      !openedAt ||
      !closedAt ||
      ordersCount === null ||
      cash === null ||
      card === null ||
      transfer === null ||
      total === null ||
      tips === null ||
      difference === null
    ) {
      return null;
    }

    return buildShiftClosedText(
      {
        locationName,
        openedAt,
        closedAt,
        closedByName: text("closedByName"),
        ordersCount,
        cash,
        card,
        transfer,
        total,
        tips,
        difference,
        reason: text("reason"),
      },
      options,
    );
  }

  if (event === "refund_over_threshold") {
    const amount = number("amount");
    const threshold = number("threshold");
    const orderNumber = text("orderNumber");
    if (amount === null || threshold === null || !orderNumber) return null;

    return buildRefundOverThresholdText(
      { orderNumber, amount, threshold, reason: text("reason") },
      options,
    );
  }

  if (event === "shift_open_over_24h") {
    const locationName = text("locationName");
    const openedAt = text("openedAt");
    const hoursOpen = number("hoursOpen");
    if (!locationName || !openedAt || hoursOpen === null) return null;

    return buildShiftOpenTooLongText({ locationName, openedAt, hoursOpen }, options);
  }

  // Los tres eventos de la lista cerrada ya se cubrieron arriba; un evento desconocido no manda nada.
  return null;
}
