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

/** 4 — el cierre de un turno quedó con diferencia por encima del umbral configurado. */
export function buildShiftCloseDifferenceText(
  input: {
    locationName: string;
    closedAt: string;
    counted: number;
    expected: number;
    difference: number;
    threshold: number;
  },
  options: TelegramAlertFormat,
): string {
  return [
    header(options, "Diferencia de caja"),
    input.locationName,
    formatShiftDateTime(input.closedAt, { timezone: options.timezone, locale: options.locale }),
    `Diferencia: ${signed(input.difference, options)} (umbral ${money(input.threshold, options)})`,
    `Contado ${money(input.counted, options)} · esperado ${money(input.expected, options)}`,
    "",
    "Mirá el arqueo en /admin/cash.",
  ].join("\n");
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

/** Resumen del día (toggle «Cierre del día»): la plata del negocio en un mensaje. */
export function buildDayCloseSummaryText(
  input: {
    businessDate: string;
    cashSales: number;
    movements: number;
    refunds: number;
    difference: number;
    shifts: number;
    open: number;
  },
  options: TelegramAlertFormat,
): string {
  return [
    header(options, `Cierre del día ${input.businessDate}`),
    `Efectivo: ${money(input.cashSales, options)}`,
    `Movimientos: ${signed(input.movements, options)}`,
    `Devoluciones: ${signed(input.refunds, options)}`,
    `Diferencia: ${signed(input.difference, options)}`,
    `Turnos: ${input.shifts}${input.open > 0 ? ` (${input.open} con la caja abierta)` : ""}`,
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

  if (event === "cash_difference_over_threshold") {
    const difference = number("difference");
    const threshold = number("threshold");
    const counted = number("counted");
    const expected = number("expected");
    const locationName = text("locationName");
    const closedAt = text("closedAt");
    if (
      difference === null ||
      threshold === null ||
      counted === null ||
      expected === null ||
      !locationName ||
      !closedAt
    ) {
      return null;
    }

    return buildShiftCloseDifferenceText(
      { locationName, closedAt, counted, expected, difference, threshold },
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

  const businessDate = text("businessDate");
  const cashSales = number("cashSales");
  const movements = number("movements");
  const refunds = number("refunds");
  const difference = number("difference");
  const shifts = number("shifts");
  const open = number("open");
  if (
    !businessDate ||
    cashSales === null ||
    movements === null ||
    refunds === null ||
    difference === null ||
    shifts === null ||
    open === null
  ) {
    return null;
  }

  return buildDayCloseSummaryText(
    { businessDate, cashSales, movements, refunds, difference, shifts, open },
    options,
  );
}
