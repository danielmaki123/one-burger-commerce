import { describe, expect, it } from "vitest";

import {
  catalogProductIds,
  resolveLocationPrice,
  summarizeLocationCatalog,
  validateLocationProductInput,
} from "@/modules/locations/domain/location-product-rules";
import type { LocationProductRecord } from "@/modules/locations/domain/location.types";

/**
 * T8 fase 4 — el catálogo por local.
 *
 * La regla que sostiene todo: **sin fila para ese local, el producto se vende al precio
 * base**. Es lo que hace que un negocio de un solo local siga funcionando sin configurar
 * nada, y evita que el menú público quede vacío el día que aparecen los locales.
 *
 * Con fila, el local decide: precio propio (o el base si no lo pisa), si está agotado y si
 * directamente no lo vende.
 */
function row(overrides: Partial<LocationProductRecord> = {}): LocationProductRecord {
  return {
    id: "lp_1",
    locationId: "loc_norte",
    productId: "prod_taco",
    priceOverride: null,
    isAvailable: true,
    isActive: true,
    ...overrides,
  };
}

describe("resolveLocationPrice", () => {
  it("sin precio propio usa el del producto", () => {
    expect(resolveLocationPrice({ basePrice: 35, priceOverride: null })).toBe(35);
  });

  it("con precio propio lo usa, aunque sea más caro o más barato", () => {
    expect(resolveLocationPrice({ basePrice: 35, priceOverride: 40 })).toBe(40);
    expect(resolveLocationPrice({ basePrice: 35, priceOverride: 30 })).toBe(30);
  });

  it("un precio propio en cero no es 'sin precio': es gratis", () => {
    expect(resolveLocationPrice({ basePrice: 35, priceOverride: 0 })).toBe(0);
  });
});

describe("validateLocationProductInput", () => {
  it("acepta lo que se puede guardar", () => {
    expect(
      validateLocationProductInput({ priceOverride: null, isAvailable: true, isActive: true }),
    ).toEqual({});
    expect(
      validateLocationProductInput({ priceOverride: 39.5, isAvailable: false, isActive: true }),
    ).toEqual({});
  });

  it("rechaza un precio negativo o con más de dos decimales", () => {
    expect(
      validateLocationProductInput({ priceOverride: -1, isAvailable: true, isActive: true })
        .priceOverride,
    ).toBeDefined();
    expect(
      validateLocationProductInput({ priceOverride: 39.999, isAvailable: true, isActive: true })
        .priceOverride,
    ).toBeDefined();
  });
});

describe("catalogProductIds", () => {
  it("los que no tienen fila están en el catálogo del local", () => {
    // El local vende todo lo activo del negocio salvo lo que apagó explícitamente.
    expect(catalogProductIds({ productIds: ["a", "b"], rows: [], locationId: "loc_norte" })).toEqual(["a", "b"]);
  });

  it("una fila apagada lo saca del local", () => {
    expect(
      catalogProductIds({ productIds: ["a", "b"], rows: [row({ productId: "b", isActive: false })], locationId: "loc_norte" }),
    ).toEqual(["a"]);
  });

  it("una fila de otro local no cambia nada", () => {
    expect(
      catalogProductIds({
        productIds: ["a"],
        rows: [row({ locationId: "loc_sur", productId: "a", isActive: false })],
        locationId: "loc_norte",
      }),
    ).toEqual(["a"]);
  });
});

describe("summarizeLocationCatalog", () => {
  it("cuenta lo que el local vende, lo agotado y lo que tiene precio propio", () => {
    const summary = summarizeLocationCatalog({
      productIds: ["a", "b", "c"],
      locationId: "loc_norte",
      rows: [
        row({ productId: "b", isAvailable: false }),
        row({ productId: "c", priceOverride: 50 }),
      ],
    });

    expect(summary).toEqual({ total: 3, sold: 3, unavailable: 1, overridden: 1 });
  });

  it("no cuenta lo que el local no vende", () => {
    const summary = summarizeLocationCatalog({
      productIds: ["a", "b"],
      locationId: "loc_norte",
      rows: [row({ productId: "b", isActive: false })],
    });

    expect(summary).toEqual({ total: 2, sold: 1, unavailable: 0, overridden: 0 });
  });
});
