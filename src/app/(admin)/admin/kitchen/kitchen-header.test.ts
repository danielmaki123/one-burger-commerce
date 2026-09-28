import { describe, expect, it } from "vitest";

import { describeKitchenLocation, formatKitchenClock } from "./kitchen-header";

/**
 * Los dos textos que la **cabecera** de Cocina necesita, fuera de la página para poder probarlos solos
 * (una página de Next no puede exportar nada más que la página: `build:webpack` falla si no).
 */

describe("describeKitchenLocation · de qué local es el turno", () => {
  it("con un solo local a la vista dice cuál es", () => {
    expect(
      describeKitchenLocation([
        { id: "loc_centro", name: "Camino de Oriente", pickupLeadMinutes: 25 },
        { id: "__sin_local__", name: null, pickupLeadMinutes: null },
      ]),
    ).toBe("Camino de Oriente");
  });

  it("con más de un local dice que se ven todos: no elige uno por su cuenta", () => {
    expect(
      describeKitchenLocation([
        { id: "a", name: "Camino de Oriente", pickupLeadMinutes: 25 },
        { id: "b", name: "Carretera Masaya", pickupLeadMinutes: 20 },
      ]),
    ).toBe("Todas las sucursales");
  });

  it("sin comandas no inventa un local", () => {
    expect(describeKitchenLocation([])).toBe("Todas las sucursales");
  });

  it("un local sin nombre no deja la cabecera vacía", () => {
    expect(
      describeKitchenLocation([{ id: "loc_borrado", name: null, pickupLeadMinutes: null }]),
    ).toBe("Todas las sucursales");
  });
});

describe("formatKitchenClock · el reloj de la cabecera", () => {
  it("usa la zona del negocio, no la del equipo que mira", () => {
    // 18:32 en Managua (UTC-6) es 00:32 UTC del día siguiente.
    expect(formatKitchenClock("2026-09-13T00:32:00.000Z", "America/Managua")).toBe("6:32 p. m.");
  });

  it("una hora ilegible dice `--:--` en vez de romper la cabecera", () => {
    expect(formatKitchenClock("no es una fecha", "America/Managua")).toBe("--:--");
  });
});
