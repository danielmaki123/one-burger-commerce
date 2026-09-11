import { describe, expect, it } from "vitest";

import { formatTimeInTimeZone } from "./format-time-in-timezone";

describe("formatTimeInTimeZone", () => {
  it("formatea en 12 horas con la zona del negocio", () => {
    // 2026-09-12T02:00Z son las 20:00 del 11 en Managua (UTC-6).
    expect(formatTimeInTimeZone("2026-09-12T02:00:00.000Z", "America/Managua")).toBe(
      "8:00 p. m.",
    );
  });

  it("no depende de la zona del equipo que lo ejecuta", () => {
    expect(formatTimeInTimeZone("2026-09-11T15:30:00.000Z", "America/Managua")).toBe(
      "9:30 a. m.",
    );
    expect(formatTimeInTimeZone("2026-09-11T15:30:00.000Z", "Europe/Madrid")).toBe(
      "5:30 p. m.",
    );
  });

  it("devuelve vacío con una fecha inválida en vez de romper el ticket", () => {
    expect(formatTimeInTimeZone("no-es-fecha", "America/Managua")).toBe("");
    expect(formatTimeInTimeZone("", "America/Managua")).toBe("");
  });

  it("cae a UTC si la zona es inválida", () => {
    expect(formatTimeInTimeZone("2026-09-11T20:00:00.000Z", "No/Existe")).toBe(
      "8:00 p. m.",
    );
  });
});
