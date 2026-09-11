import { describe, expect, it } from "vitest";

import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";

import {
  buildPickupSlots,
  formatSlotLabel,
  MAX_PICKUP_SLOTS,
  PICKUP_SLOT_MINUTES,
  soonestPickupTime,
} from "./pickup-slots";

/** `-06:00` es la zona de Managua, que no tiene horario de verano. */
function managuaAt(hhmm: string): Date {
  return new Date(`2026-09-11T${hhmm}:00-06:00`);
}

/** Todos los días con el mismo horario: así el test no depende del día de la semana. */
function hoursWith(overrides: Partial<BusinessHours["fri"]> = {}): BusinessHours {
  const day = { closed: false, open: "12:00", close: "22:00", ...overrides };

  return {
    mon: { ...day },
    tue: { ...day },
    wed: { ...day },
    thu: { ...day },
    fri: { ...day },
    sat: { ...day },
    sun: { ...day },
  };
}

const base = {
  timezone: "America/Managua",
  pickupLeadMinutes: 25,
};

describe("buildPickupSlots", () => {
  it("no ofrece turnos si el local está cerrado hoy", () => {
    const result = buildPickupSlots({
      ...base,
      businessHours: hoursWith({ closed: true }),
      now: managuaAt("19:00"),
    });

    expect(result).toEqual({ available: false, reason: "closed" });
  });

  it("arranca en la hora de apertura cuando todavía no abrió", () => {
    const result = buildPickupSlots({
      ...base,
      businessHours: hoursWith(),
      now: managuaAt("09:00"),
    });

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.slots[0]).toEqual({
      value: "12:00",
      label: "12:00 p. m.",
      isSoonest: true,
    });
  });

  it("respeta el tiempo de preparación y alinea los turnos con la apertura", () => {
    const result = buildPickupSlots({
      ...base,
      businessHours: hoursWith(),
      now: managuaAt("19:10"),
    });

    expect(result.available).toBe(true);
    if (!result.available) return;
    // 19:10 + 25 min = 19:35; el siguiente turno alineado con la apertura es 20:00.
    expect(result.slots.map((slot) => slot.value)).toEqual([
      "20:00",
      "20:30",
      "21:00",
      "21:30",
    ]);
  });

  it("nunca ofrece la hora de cierre como turno", () => {
    const result = buildPickupSlots({
      ...base,
      businessHours: hoursWith(),
      now: managuaAt("12:00"),
      pickupLeadMinutes: 0,
      maxSlots: 100,
    });

    expect(result.available).toBe(true);
    if (!result.available) return;
    const values = result.slots.map((slot) => slot.value);
    expect(values.at(-1)).toBe("21:30");
    expect(values).not.toContain("22:00");
  });

  it("no ofrece turnos cuando ya no queda tiempo antes del cierre", () => {
    const result = buildPickupSlots({
      ...base,
      businessHours: hoursWith(),
      now: managuaAt("21:50"),
    });

    expect(result).toEqual({ available: false, reason: "no-slots-left" });
  });

  it("marca solo el primer turno como el más próximo", () => {
    const result = buildPickupSlots({
      ...base,
      businessHours: hoursWith(),
      now: managuaAt("19:30"),
    });

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.slots[0].isSoonest).toBe(true);
    expect(result.slots.slice(1).every((slot) => !slot.isSoonest)).toBe(true);
  });

  it("limita la cantidad de turnos ofrecidos", () => {
    const result = buildPickupSlots({
      ...base,
      businessHours: hoursWith(),
      now: managuaAt("12:00"),
      pickupLeadMinutes: 0,
      maxSlots: 2,
    });

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.slots.map((slot) => slot.value)).toEqual(["12:00", "12:30"]);
  });

  it("usa el espaciado configurado", () => {
    const result = buildPickupSlots({
      ...base,
      businessHours: hoursWith(),
      now: managuaAt("12:00"),
      pickupLeadMinutes: 0,
      slotMinutes: 60,
    });

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.slots.map((slot) => slot.value)).toEqual([
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
    ]);
  });

  it("no explota con una zona horaria inválida", () => {
    const result = buildPickupSlots({
      ...base,
      timezone: "No/Existe",
      businessHours: hoursWith(),
      now: managuaAt("19:10"),
    });

    expect(result.available).toBe(true);
  });

  it("usa el espaciado por defecto de media hora", () => {
    expect(PICKUP_SLOT_MINUTES).toBe(30);
    expect(MAX_PICKUP_SLOTS).toBe(5);
  });
});

describe("formatSlotLabel", () => {
  it("formatea en 12 horas con a. m. y p. m.", () => {
    expect(formatSlotLabel("19:30")).toBe("7:30 p. m.");
    expect(formatSlotLabel("07:05")).toBe("7:05 a. m.");
    expect(formatSlotLabel("12:00")).toBe("12:00 p. m.");
    expect(formatSlotLabel("00:30")).toBe("12:30 a. m.");
    expect(formatSlotLabel("13:00")).toBe("1:00 p. m.");
  });
});

describe("soonestPickupTime", () => {
  it("suma el tiempo de preparación y redondea hacia arriba", () => {
    expect(
      soonestPickupTime({
        now: managuaAt("19:10"),
        timezone: "America/Managua",
        pickupLeadMinutes: 25,
      }),
    ).toBe("19:35");
  });

  it("redondea al siguiente múltiplo del paso", () => {
    expect(
      soonestPickupTime({
        now: managuaAt("19:11"),
        timezone: "America/Managua",
        pickupLeadMinutes: 25,
        stepMinutes: 10,
      }),
    ).toBe("19:40");
  });

  it("sin tiempo de preparación devuelve la hora actual redondeada", () => {
    expect(
      soonestPickupTime({
        now: managuaAt("19:11"),
        timezone: "America/Managua",
        pickupLeadMinutes: 0,
      }),
    ).toBe("19:15");
  });

  it("nunca se pasa de la medianoche", () => {
    expect(
      soonestPickupTime({
        now: managuaAt("23:58"),
        timezone: "America/Managua",
        pickupLeadMinutes: 25,
      }),
    ).toBe("23:55");
  });
});
