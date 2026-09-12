import { describe, expect, it } from "vitest";

import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";
import { buildPickupPreview } from "./pickup-preview-helpers";

/**
 * Fase 2 del checkout — la vista previa del admin.
 *
 * El owner escribe "25" en minutos de preparación y no ve que eso significa "última
 * orden 21:35". Esta vista muestra, con la configuración que está editando, los turnos
 * que vería el cliente y hasta qué hora entra un pedido. Como es la misma función que
 * usa el checkout, no puede decir algo distinto de lo que pasa.
 */
function hours(open: string, close: string, closed = false): BusinessHours {
  return {
    mon: { open, close, closed },
    tue: { open, close, closed },
    wed: { open, close, closed },
    thu: { open, close, closed },
    fri: { open, close, closed },
    sat: { open, close, closed },
    sun: { open, close, closed },
  };
}

/** Sábado 12/09/2026 a las 12:00 en Managua (UTC-6). */
const NOON_MANAGUA = new Date("2026-09-12T18:00:00.000Z");

const base = {
  businessHours: hours("12:00", "22:00"),
  timezone: "America/Managua",
  pickupMaxMinutes: null,
  now: NOON_MANAGUA,
};

describe("buildPickupPreview", () => {
  it("muestra los turnos que vería el cliente, alineados con la apertura", () => {
    const preview = buildPickupPreview({ ...base, pickupLeadMinutes: 25 });

    // Abre 12:00 y son las 12:00: el primer turno llega con los 25 minutos.
    expect(preview.slots[0].value).toBe("12:30");
    expect(preview.slots.map((slot) => slot.value)).toEqual([
      "12:30",
      "13:00",
      "13:30",
      "14:00",
      "14:30",
    ]);
    expect(preview.notice).toBeNull();
  });

  it("dice hasta qué hora entra un pedido hoy", () => {
    const preview = buildPickupPreview({ ...base, pickupLeadMinutes: 25 });

    // El local cierra 22:00 y el pedido tarda 25 minutos: la última orden entra 21:35.
    expect(preview.lastOrderTime).toBe("21:35");
    expect(preview.lastOrderLabel).toBe("9:35 p. m.");
  });

  it("el copy de 'lo antes posible' usa el rango cuando hay máximo", () => {
    // Como en el checkout: "lo antes posible" es ahora + preparación (paso de 5 min),
    // no el primer turno de la grilla.
    expect(buildPickupPreview({ ...base, pickupLeadMinutes: 25 }).soonestLabel).toBe(
      "listo ~12:25 p. m.",
    );

    expect(
      buildPickupPreview({ ...base, pickupLeadMinutes: 20, pickupMaxMinutes: 40 }).soonestLabel,
    ).toBe("listo entre 12:20 p. m. y 12:40 p. m.");
  });

  it("si hoy el local está cerrado, lo dice y no inventa turnos", () => {
    const preview = buildPickupPreview({
      ...base,
      businessHours: hours("12:00", "22:00", true),
      pickupLeadMinutes: 25,
    });

    expect(preview.slots).toEqual([]);
    expect(preview.notice).toContain("cerrado");
    // Sin horario de hoy no hay "última orden" que mostrar: el horario es el de los
    // días que sí abre.
    expect(preview.lastOrderTime).toBeNull();
  });

  it("si ya no quedan turnos del día, avisa y muestra la hora calculada", () => {
    // 21:50 en Managua: cierra a las 22:00 y el pedido tarda 25 minutos.
    const preview = buildPickupPreview({
      ...base,
      now: new Date("2026-09-13T03:50:00.000Z"),
      pickupLeadMinutes: 25,
    });

    expect(preview.slots).toEqual([]);
    expect(preview.notice).toContain("no quedan turnos");
    // El checkout no bloquea: le da "ahora + preparación", redondeado.
    expect(preview.soonestLabel).toContain("10:15 p. m.");
    expect(preview.lastOrderTime).toBe("21:35");
  });

  it("un horario incoherente se trata como cerrado", () => {
    const preview = buildPickupPreview({
      ...base,
      businessHours: hours("22:00", "12:00"),
      pickupLeadMinutes: 25,
    });

    expect(preview.slots).toEqual([]);
    expect(preview.notice).toContain("cerrado");
  });
});
