import { describe, expect, it } from "vitest";

import { formatRelativeTime } from "./relative-time";

/**
 * Decisión del owner (2026-09-17) — «Hace 2 h» en el historial de envíos de las alertas.
 *
 * Es un texto para leer de reojo en el teléfono: minutos, horas y días alcanzan; no se muestran segundos ni
 * «hace 1,5 horas». Se calcula con dos instantes (el del envío y el de ahora) para poder probarlo sin
 * relojes falsos.
 */

describe("formatRelativeTime", () => {
  const ahora = "2026-09-17T18:00:00.000Z";

  it("los envíos recién salidos dicen «Ahora»", () => {
    expect(formatRelativeTime("2026-09-17T18:00:00.000Z", ahora)).toBe("Ahora");
    expect(formatRelativeTime("2026-09-17T17:59:30.000Z", ahora)).toBe("Ahora");
  });

  it("los minutos y las horas se dicen en corto", () => {
    expect(formatRelativeTime("2026-09-17T17:55:00.000Z", ahora)).toBe("Hace 5 min");
    expect(formatRelativeTime("2026-09-17T16:00:00.000Z", ahora)).toBe("Hace 2 h");
    expect(formatRelativeTime("2026-09-17T17:59:00.000Z", ahora)).toBe("Hace 1 min");
  });

  it("un día entero es «Ayer» y más días van en número", () => {
    expect(formatRelativeTime("2026-09-16T18:00:00.000Z", ahora)).toBe("Ayer");
    expect(formatRelativeTime("2026-09-14T18:00:00.000Z", ahora)).toBe("Hace 3 días");
  });

  it("una fecha que no se entiende no inventa un tiempo", () => {
    expect(formatRelativeTime("no-es-fecha", ahora)).toBe("");
  });
});
