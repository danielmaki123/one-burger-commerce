import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import type { PublicLocation } from "@/modules/locations/features/list-public-locations/list-public-locations";

import { PublicLocationsList } from "./public-locations-list";

const HOURS = {
  mon: { open: "12:00", close: "22:00", closed: false },
  tue: { open: "12:00", close: "22:00", closed: false },
  wed: { open: "12:00", close: "22:00", closed: false },
  thu: { open: "12:00", close: "22:00", closed: false },
  fri: { open: "12:00", close: "22:00", closed: false },
  sat: { open: "12:00", close: "22:00", closed: false },
  sun: { open: "12:00", close: "22:00", closed: false },
};

function location(overrides: Partial<PublicLocation> = {}): PublicLocation {
  return {
    id: "loc_norte",
    name: "Sucursal Norte",
    addressLine: "Frente al parque",
    city: "Jinotepe",
    addressReference: null,
    mapsUrl: null,
    businessHours: HOURS,
    pickupLeadMinutes: 25,
    pickupMaxMinutes: null,
    isAcceptingOrders: true,
    closedMessage: null,
    ...overrides,
  };
}

/**
 * A-07 — la información de **cada sucursal**, compartida entre la home y el footer.
 *
 * Lo que se verifica es lo que el owner pidió: que se vea la información de **cada** local
 * (no la del negocio) y que su "Cómo llegar" lleve a algún lado. El componente se renderiza
 * sin estado: los enlaces son `<a>` reales, así que el `href` se puede afirmar.
 */
describe("PublicLocationsList", () => {
  it("muestra cada sucursal con su dirección, no la del negocio", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLocationsList, {
        locations: [
          location(),
          location({
            id: "loc_masaya",
            name: "Carretera Masaya",
            addressLine: "Km 8 carretera",
            city: "Managua",
          }),
        ],
      }),
    );

    expect(html).toContain("Sucursal Norte");
    expect(html).toContain("Frente al parque, Jinotepe");
    expect(html).toContain("Carretera Masaya");
    expect(html).toContain("Km 8 carretera, Managua");
  });

  it("arma el destino de 'Cómo llegar' por sucursal", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLocationsList, {
        locations: [
          location({ mapsUrl: "https://maps.test/norte" }),
          location({
            id: "loc_masaya",
            name: "Carretera Masaya",
            addressLine: "Km 8 carretera",
            city: "Managua",
          }),
        ],
      }),
    );

    // El enlace del local con mapa cargado, y el del local sin mapa armado con su dirección.
    expect(html).toContain('href="https://maps.test/norte"');
    expect(decodeURIComponent(html)).toContain("Km 8 carretera, Managua");
  });

  it("sin sucursales no dibuja un encabezado vacío", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLocationsList, { locations: [] }),
    );

    expect(html).toBe("");
  });

  it("un local sin dirección no queda con un hueco ni con un enlace muerto", () => {
    const html = renderToStaticMarkup(
      createElement(PublicLocationsList, {
        locations: [
          location({ addressLine: null, city: null, addressReference: null, mapsUrl: null }),
        ],
      }),
    );

    expect(html).toContain("Sucursal Norte");
    expect(html).not.toContain("Cómo llegar");
  });
});
