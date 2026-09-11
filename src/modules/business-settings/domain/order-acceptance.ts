import { getWeekdayInTimeZone } from "@/modules/business-settings/domain/business-hours-format";
import {
  minutesOfDayInTimeZone,
  parseTimeOfDay,
} from "@/modules/business-settings/domain/pickup-slots";
import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";

/**
 * ¿Se puede tomar este pedido?
 *
 * Antes el servidor no miraba el estado operativo: `isAcceptingOrders` existía en la
 * configuración y en el panel del admin, pero **ningún caso de uso lo leía**, así que
 * apagarlo no cortaba nada; y la hora de retiro se aceptaba con solo ser una fecha
 * parseable, incluidas las 04:00 de un local que abre a las 12:00.
 *
 * Esta función es la única fuente de verdad de esa decisión, y la usan tanto el API
 * como el checkout.
 */

export type OrderRejectionReason =
  | "not-accepting-orders"
  | "closed"
  | "pickup-time-in-past";

export type OrderAcceptance =
  | { accepted: true }
  | { accepted: false; reason: OrderRejectionReason; message: string };

const FALLBACK_MESSAGES: Record<OrderRejectionReason, string> = {
  "not-accepting-orders": "Por ahora no estamos aceptando pedidos.",
  closed: "Está fuera del horario de atención. Elegí otra hora de retiro.",
  "pickup-time-in-past": "La hora de retiro elegida ya pasó. Elegí una nueva.",
};

export function resolveOrderAcceptance(input: {
  isAcceptingOrders: boolean;
  closedMessage: string | null;
  businessHours: BusinessHours;
  timezone: string;
  pickupLeadMinutes: number;
  now: Date;
  /**
   * Hora de retiro pedida. Sin hora se evalúa "lo antes posible" (ahora + tiempo de
   * preparación), para que omitirla no sea una forma de saltear el horario.
   */
  pickupTime: Date | null;
}): OrderAcceptance {
  const reject = (
    reason: OrderRejectionReason,
    useConfiguredMessage = false,
  ): OrderAcceptance => ({
    accepted: false,
    reason,
    message:
      (useConfiguredMessage ? input.closedMessage?.trim() : "") || FALLBACK_MESSAGES[reason],
  });

  if (!input.isAcceptingOrders) {
    return reject("not-accepting-orders", true);
  }

  if (input.pickupTime && input.pickupTime.getTime() < input.now.getTime()) {
    return reject("pickup-time-in-past");
  }

  const effective =
    input.pickupTime ??
    new Date(input.now.getTime() + Math.max(0, input.pickupLeadMinutes) * 60_000);

  // El horario que manda es el del día del retiro, no el de hoy.
  const day = input.businessHours[getWeekdayInTimeZone(effective, input.timezone)];
  if (!day || day.closed) {
    return reject("closed", true);
  }

  const open = parseTimeOfDay(day.open);
  const close = parseTimeOfDay(day.close);

  // Un horario incoherente (o que cruza la medianoche) cierra el local: es preferible
  // rechazar de más que aceptar un pedido a cualquier hora.
  if (open === null || close === null || close <= open) {
    return reject("closed", true);
  }

  const minutes = minutesOfDayInTimeZone(effective, input.timezone);
  if (minutes < open || minutes > close) {
    return reject("closed", true);
  }

  return { accepted: true };
}
