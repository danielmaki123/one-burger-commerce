import { describe, expect, it } from "vitest";

import { locationDirectionsHref } from "./location-links";

/**
 * A-07 — el enlace de "Cómo llegar" de **cada local**.
 *
 * Es la versión por sucursal de lo que la home ya hacía para el negocio: se usa el mapa que
 * el owner cargó en el local y, si no lo cargó, se arma una búsqueda con su dirección. Nunca
 * un enlace vacío: sin datos devuelve `null` y el consumidor no dibuja el control.
 */
describe("locationDirectionsHref", () => {
  it("usa el mapa que el owner cargó en el local", () => {
    expect(
      locationDirectionsHref({
        mapsUrl: "https://maps.test/norte",
        addressLine: "Frente al parque",
        addressReference: null,
        city: "Jinotepe",
      }),
    ).toBe("https://maps.test/norte");
  });

  it("sin mapa arma una búsqueda con la dirección del local", () => {
    const href = locationDirectionsHref({
      mapsUrl: null,
      addressLine: "Frente al parque",
      addressReference: "Portón verde",
      city: "Jinotepe",
    });

    expect(href).toContain("google.com/maps/search");
    expect(decodeURIComponent(href ?? "")).toContain("Frente al parque, Portón verde, Jinotepe");
  });

  it("sin mapa ni dirección no inventa un enlace", () => {
    expect(
      locationDirectionsHref({
        mapsUrl: null,
        addressLine: null,
        addressReference: "   ",
        city: null,
      }),
    ).toBeNull();
  });

  it("un mapa cargado gana aunque la dirección esté vacía", () => {
    expect(
      locationDirectionsHref({
        mapsUrl: "https://maps.test/solo-mapa",
        addressLine: null,
        addressReference: null,
        city: null,
      }),
    ).toBe("https://maps.test/solo-mapa");
  });
});
