import { describe, expect, it } from "vitest";

import type { BusinessHours } from "@/modules/business-settings/domain/business-settings.types";

import {
  addDays,
  buildPickupSlotsForDay,
  dateInTimeZone,
  formatDayHours,
  formatPickupDayLabel,
  pickupDayLabel,
  pickupInstant,
  weekdayOfDate,
} from "./pickup-days";

/**
 * Fase 4 del checkout (D1) — pedidos para días futuros.
 *
 * El negocio atiende de 12:00 a 22:00 y el cliente puede pedir para cualquier día,
 * **sin tope**: el único límite es el horario de ese día. El día elegido decide los
 * turnos, y el día natural se calcula en la zona del negocio, no en la del celular.
 */
const HOURS: BusinessHours = {
  mon: { open: "12:00", close: "22:00", closed: false },
  tue: { open: "12:00", close: "22:00", closed: false },
  wed: { open: "12:00", close: "22:00", closed: false },
  thu: { open: "12:00", close: "22:00", closed: false },
  fri: { open: "12:00", close: "22:00", closed: false },
  sat: { open: "12:00", close: "22:00", closed: false },
  // El lunes cierra: es el caso que el cliente tiene que ver claro.
  sun: { open: "00:00", close: "00:00", closed: true },
};

const MANAGUA = "America/Managua";

describe("dateInTimeZone", () => {
  it("devuelve el día natural del negocio, no el del reloj del celular", () => {
    // 2026-09-13 a las 01:00 en Managua (UTC-6) = 07:00 UTC del mismo día.
    expect(dateInTimeZone(new Date("2026-09-13T07:00:00.000Z"), MANAGUA)).toBe("2026-09-13");

    // 2026-09-13 a las 23:30 en Managua = 05:30 UTC del 14: en Tokio ya es el 14,
    // en el negocio todavía es el 13.
    expect(dateInTimeZone(new Date("2026-09-14T05:30:00.000Z"), MANAGUA)).toBe("2026-09-13");
    expect(dateInTimeZone(new Date("2026-09-14T05:30:00.000Z"), "Asia/Tokyo")).toBe("2026-09-14");
  });
});

describe("addDays", () => {
  it("suma días cruzando meses y años", () => {
    expect(addDays("2026-09-13", 1)).toBe("2026-09-14");
    expect(addDays("2026-09-30", 1)).toBe("2026-10-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    // Año bisiesto.
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
});

describe("weekdayOfDate", () => {
  it("saca el día de la semana del día natural", () => {
    expect(weekdayOfDate("2026-09-13")).toBe("sun");
    expect(weekdayOfDate("2026-09-14")).toBe("mon");
    expect(weekdayOfDate("2026-09-19")).toBe("sat");
  });
});

describe("pickupInstant", () => {
  it("arma el instante UTC de una hora del negocio, sin depender del reloj del cliente", () => {
    // 13:30 en Managua (UTC-6) = 19:30 UTC.
    expect(
      pickupInstant({ date: "2026-09-13", time: "13:30", timeZone: MANAGUA })?.toISOString(),
    ).toBe("2026-09-13T19:30:00.000Z");

    // Misma hora del negocio en otra zona: 13:30 en Tokio = 04:30 UTC.
    expect(
      pickupInstant({ date: "2026-09-13", time: "13:30", timeZone: "Asia/Tokyo" })?.toISOString(),
    ).toBe("2026-09-13T04:30:00.000Z");
  });

  it("con hora inválida o fecha inválida devuelve null", () => {
    expect(pickupInstant({ date: "2026-09-13", time: "25:00", timeZone: MANAGUA })).toBeNull();
    expect(pickupInstant({ date: "2026-09-13", time: "", timeZone: MANAGUA })).toBeNull();
    expect(pickupInstant({ date: "13/09/2026", time: "13:30", timeZone: MANAGUA })).toBeNull();
    expect(pickupInstant({ date: "2026-13-40", time: "13:30", timeZone: MANAGUA })).toBeNull();
  });

  it("una zona horaria inválida no rompe: cae a UTC", () => {
    expect(
      pickupInstant({ date: "2026-09-13", time: "13:30", timeZone: "Mars/Olympus" })?.toISOString(),
    ).toBe("2026-09-13T13:30:00.000Z");
  });
});

describe("formatPickupDayLabel", () => {
  it("nombra hoy y mañana como tales", () => {
    expect(formatPickupDayLabel({ date: "2026-09-13", today: "2026-09-13" })).toBe("Hoy");
    expect(formatPickupDayLabel({ date: "2026-09-14", today: "2026-09-13" })).toBe("Mañana");
  });

  it("para el resto usa el día de la semana y la fecha", () => {
    const label = formatPickupDayLabel({ date: "2026-09-18", today: "2026-09-13" });

    expect(label).toContain("viernes");
    expect(label).toContain("18");
    expect(label).toContain("septiembre");
    expect(label).not.toContain("Hoy");
  });

  it("un día pasado se nombra con su fecha, no como 'Hoy'", () => {
    const label = formatPickupDayLabel({ date: "2026-09-12", today: "2026-09-13" });

    expect(label).toContain("12");
    expect(label).not.toBe("Hoy");
  });
});

describe("pickupDayLabel", () => {
  const nowMs = new Date("2026-09-11T18:00:00-06:00").getTime();

  it("no dice nada cuando el retiro es hoy", () => {
    expect(
      pickupDayLabel({ pickupTime: "2026-09-12T02:00:00.000Z", nowMs, timeZone: MANAGUA }),
    ).toBe("");
  });

  it("nombra el día cuando el retiro es otro día", () => {
    expect(
      pickupDayLabel({ pickupTime: "2026-09-13T02:00:00.000Z", nowMs, timeZone: MANAGUA }),
    ).toBe("mañana");
    expect(
      pickupDayLabel({ pickupTime: "2026-09-19T02:00:00.000Z", nowMs, timeZone: MANAGUA }),
    ).toContain("viernes 18 de septiembre");
  });

  it("un retiro que ya pasó no repite la fecha", () => {
    expect(
      pickupDayLabel({ pickupTime: "2026-09-11T02:00:00.000Z", nowMs, timeZone: MANAGUA }),
    ).toBe("");
  });

  it("con una fecha inválida no inventa un día", () => {
    expect(pickupDayLabel({ pickupTime: "no-es-fecha", nowMs, timeZone: MANAGUA })).toBe("");
  });
});

describe("formatDayHours", () => {  it("describe el horario del día elegido", () => {
    expect(formatDayHours(HOURS, "2026-09-14")).toBe("de 12:00 a 22:00");
  });

  it("un día cerrado o con horario incoherente no tiene texto", () => {
    expect(formatDayHours(HOURS, "2026-09-13")).toBeNull();
    expect(
      formatDayHours({ ...HOURS, mon: { open: "22:00", close: "12:00", closed: false } }, "2026-09-14"),
    ).toBeNull();
  });
});

describe("buildPickupSlotsForDay", () => {
  it("ofrece todo el día desde la apertura, sin la espera de preparación", () => {
    const result = buildPickupSlotsForDay({
      businessHours: HOURS,
      date: "2026-09-14",
      slotMinutes: 60,
    });

    expect(result.available).toBe(true);
    if (!result.available) return;

    // La preparación empuja los turnos de **hoy**, no los de un día futuro.
    expect(result.slots[0].value).toBe("12:00");
    expect(result.slots[0].isSoonest).toBe(false);
    expect(result.slots.map((slot) => slot.value)).toEqual([
      "12:00",
      "13:00",
      "14:00",
      "15:00",
      "16:00",
      "17:00",
      "18:00",
      "19:00",
      "20:00",
      "21:00",
    ]);
  });

  it("un día cerrado no ofrece turnos, con su motivo", () => {
    expect(
      buildPickupSlotsForDay({ businessHours: HOURS, date: "2026-09-13" }),
    ).toEqual({ available: false, reason: "closed" });
  });

  it("un horario incoherente se trata como cerrado", () => {
    const raro: BusinessHours = {
      ...HOURS,
      mon: { open: "22:00", close: "12:00", closed: false },
    };

    expect(buildPickupSlotsForDay({ businessHours: raro, date: "2026-09-14" })).toEqual({
      available: false,
      reason: "closed",
    });
  });

  it("respeta el tope de turnos cuando se pide uno", () => {
    const result = buildPickupSlotsForDay({
      businessHours: HOURS,
      date: "2026-09-14",
      slotMinutes: 60,
      maxSlots: 3,
    });

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.slots.map((slot) => slot.value)).toEqual(["12:00", "13:00", "14:00"]);
  });

  it("sin tope, un día largo ofrece todos sus turnos (D1: sin límite de días)", () => {
    const result = buildPickupSlotsForDay({
      businessHours: HOURS,
      date: "2026-09-14",
      slotMinutes: 30,
    });

    expect(result.available).toBe(true);
    if (!result.available) return;
    // 12:00 a 22:00 cada 30 minutos = 20 turnos, el último 21:30.
    expect(result.slots).toHaveLength(20);
    expect(result.slots[result.slots.length - 1].value).toBe("21:30");
  });

  it("los turnos nunca llegan a la hora de cierre", () => {
    const result = buildPickupSlotsForDay({
      businessHours: HOURS,
      date: "2026-09-14",
      slotMinutes: 60,
    });

    expect(result.available).toBe(true);
    if (!result.available) return;
    expect(result.slots.every((slot) => slot.value < "22:00")).toBe(true);
  });
});
