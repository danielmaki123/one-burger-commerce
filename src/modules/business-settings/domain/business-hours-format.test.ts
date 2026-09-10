import { describe, expect, it } from "vitest";

import {
  formatBusinessHoursSummary,
  formatTodayHours,
  getWeekdayInTimeZone,
} from "@/modules/business-settings/domain/business-hours-format";
import {
  DEFAULT_BUSINESS_HOURS,
  DEFAULT_BUSINESS_SETTINGS,
} from "@/modules/business-settings/domain/business-settings-defaults";
import { mergeBusinessHours } from "@/modules/business-settings/domain/business-hours";

const MANAGUA = DEFAULT_BUSINESS_SETTINGS.timezone;

describe("resumen de horarios", () => {
  it("agrupa la semana abierta con el mismo horario", () => {
    expect(formatBusinessHoursSummary(DEFAULT_BUSINESS_HOURS)).toBe("Lun - Dom 12:00 - 22:00");
  });

  it("separa los días que tienen otro horario o están cerrados", () => {
    const hours = mergeBusinessHours(DEFAULT_BUSINESS_HOURS, {
      sun: { closed: true, open: "12:00", close: "22:00" },
      sat: { closed: false, open: "10:00", close: "16:00" },
    });

    expect(formatBusinessHoursSummary(hours)).toBe(
      "Lun - Vie 12:00 - 22:00 · Sáb 10:00 - 16:00 · Dom cerrado",
    );
  });

  it("no rompe si toda la semana está cerrada", () => {
    const hours = mergeBusinessHours(null, {
      mon: { closed: true, open: "12:00", close: "22:00" },
      tue: { closed: true, open: "12:00", close: "22:00" },
      wed: { closed: true, open: "12:00", close: "22:00" },
      thu: { closed: true, open: "12:00", close: "22:00" },
      fri: { closed: true, open: "12:00", close: "22:00" },
      sat: { closed: true, open: "12:00", close: "22:00" },
      sun: { closed: true, open: "12:00", close: "22:00" },
    });

    expect(formatBusinessHoursSummary(hours)).toBe("Lun - Dom cerrado");
  });
});

describe("horario de hoy", () => {
  it("resuelve el día de la semana en la zona del negocio", () => {
    // 2026-09-10T18:00:00Z son las 12:00 en Managua (UTC-6): jueves.
    expect(getWeekdayInTimeZone(new Date("2026-09-10T18:00:00Z"), MANAGUA)).toBe("thu");
    // 2026-09-11T03:00:00Z son las 21:00 del jueves en Managua, no del viernes.
    expect(getWeekdayInTimeZone(new Date("2026-09-11T03:00:00Z"), MANAGUA)).toBe("thu");
  });

  it("describe el horario de hoy a partir de la configuración", () => {
    expect(
      formatTodayHours(DEFAULT_BUSINESS_HOURS, new Date("2026-09-10T18:00:00Z"), MANAGUA),
    ).toBe("hoy de 12:00 a 22:00");
  });

  it("avisa cuando hoy está cerrado", () => {
    const hours = mergeBusinessHours(DEFAULT_BUSINESS_HOURS, {
      thu: { closed: true, open: "12:00", close: "22:00" },
    });

    expect(formatTodayHours(hours, new Date("2026-09-10T18:00:00Z"), MANAGUA)).toBe("hoy cerrado");
  });
});
