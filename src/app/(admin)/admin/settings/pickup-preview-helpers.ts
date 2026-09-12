import { getWeekdayInTimeZone } from "@/modules/business-settings/domain/business-hours-format";
import {
  buildPickupSlots,
  formatPickupRangeLabel,
  formatSlotLabel,
  parseTimeOfDay,
  soonestPickupTime,
} from "@/modules/business-settings/domain/pickup-slots";
import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";

/**
 * Fase 2 del checkout — la vista previa del admin.
 *
 * El owner escribe "25" en minutos de preparación y no ve que eso significa "última
 * orden 21:35". Esta vista compone **las mismas funciones que usa el checkout**
 * (`buildPickupSlots`, `soonestPickupTime`, `formatPickupRangeLabel`) con la
 * configuración que se está editando, así que no puede decir algo distinto de lo que
 * el cliente va a ver.
 */
export type PickupPreviewSlot = { value: string; label: string };

export type PickupPreview = {
  /** Turnos que ofrecería el checkout en este momento. Vacío si no hay. */
  slots: PickupPreviewSlot[];
  /** Por qué no hay turnos (o `null` si sí hay). */
  notice: string | null;
  /** Copy de "lo antes posible", tal como lo ve el cliente. */
  soonestLabel: string;
  /** `21:35`: la última hora a la que hoy entra un pedido. `null` si hoy no abre. */
  lastOrderTime: string | null;
  /** `9:35 p. m.` */
  lastOrderLabel: string | null;
};

export function buildPickupPreview(input: {
  businessHours: BusinessHours;
  timezone: string;
  pickupLeadMinutes: number;
  pickupMaxMinutes: number | null;
  now: Date;
}): PickupPreview {
  const lead = Math.max(0, Math.trunc(input.pickupLeadMinutes));
  const soonest = soonestPickupTime({
    now: input.now,
    timezone: input.timezone,
    pickupLeadMinutes: lead,
  });

  const slotResult = buildPickupSlots({
    businessHours: input.businessHours,
    timezone: input.timezone,
    pickupLeadMinutes: lead,
    now: input.now,
  });

  return {
    slots: slotResult.available
      ? slotResult.slots.map((slot) => ({ value: slot.value, label: slot.label }))
      : [],
    notice: slotResult.available
      ? null
      : slotResult.reason === "closed"
        ? "Hoy el local está cerrado (o el horario no es válido): el cliente no ve turnos."
        : "Hoy ya no quedan turnos: el cliente ve la hora calculada (ahora + preparación).",
    soonestLabel: formatPickupRangeLabel({
      pickupTime: soonest,
      pickupLeadMinutes: lead,
      pickupMaxMinutes: input.pickupMaxMinutes,
    }),
    ...lastOrderOfDay(input.businessHours, input.timezone, lead, input.now),
  };
}

/**
 * Última hora a la que entra un pedido hoy: el cierre menos lo que tarda la cocina.
 *
 * Un pedido se acepta mientras `ahora + preparación` caiga dentro del horario, así que
 * la última orden entra justo `preparación` minutos antes de cerrar.
 */
function lastOrderOfDay(
  businessHours: BusinessHours,
  timezone: string,
  lead: number,
  now: Date,
): { lastOrderTime: string | null; lastOrderLabel: string | null } {
  const today = businessHours[getWeekdayInTimeZone(now, timezone)];
  if (!today || today.closed) return { lastOrderTime: null, lastOrderLabel: null };

  const open = parseTimeOfDay(today.open);
  const close = parseTimeOfDay(today.close);
  if (open === null || close === null || close <= open) {
    return { lastOrderTime: null, lastOrderLabel: null };
  }

  const lastOrder = close - lead;
  if (lastOrder < open) return { lastOrderTime: null, lastOrderLabel: null };

  const hours = Math.floor(lastOrder / 60);
  const minutes = lastOrder % 60;
  const value = `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;

  return { lastOrderTime: value, lastOrderLabel: formatSlotLabel(value) };
}
