import { describe, expect, it } from "vitest";

import { isBusinessDay } from "./business-days";

/**
 * Tarea 1.5 del roadmap (2026-09-17) — el validador del **día del negocio** que llega por la URL.
 *
 * Lo usan las pantallas con fecha en la query (el reporte del día, la conciliación). Lo que evita: que una
 * fecha mal escrita deje el filtro abierto —el reporte mostraría el historial entero como si fuera un
 * día— o que rompa la pantalla. Es solo la **forma**; si el día existe lo decide el calendario.
 */

describe("isBusinessDay", () => {
  it("acepta el día natural del negocio", () => {
    expect(isBusinessDay("2026-09-17")).toBe(true);
    expect(isBusinessDay(" 2026-09-17 ")).toBe(true);
  });

  it("rechaza lo que no es una fecha de día", () => {
    expect(isBusinessDay("17/09/2026")).toBe(false);
    expect(isBusinessDay("2026-09-17T10:00:00Z")).toBe(false);
    expect(isBusinessDay("ayer")).toBe(false);
    expect(isBusinessDay("")).toBe(false);
  });

  it("rechaza lo que no es texto (query ausente o array repetido)", () => {
    expect(isBusinessDay(null)).toBe(false);
    expect(isBusinessDay(undefined)).toBe(false);
    expect(isBusinessDay(["2026-09-17", "2026-09-18"])).toBe(false);
  });
});
