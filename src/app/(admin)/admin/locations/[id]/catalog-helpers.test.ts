import { describe, expect, it } from "vitest";

import {
  CATALOG_STATUS_LABELS,
  catalogFormToInput,
  catalogItemToForm,
  createEmptyCatalogForm,
  describeCatalogSummary,
  describeLocationProductRow,
  locationCatalogStatus,
} from "./catalog-helpers";

/**
 * T8 fase 4b — la pantalla del catálogo por local.
 *
 * Cada fila cuenta dos cosas a la vez: el precio del negocio (base) y el de este local, que
 * es el que cobraría el servidor. Y el estado: se vende acá, está agotado, o no se vende.
 */
const item = {
  productId: "prod_1",
  name: "Taco de birria",
  categoryId: "cat_tacos",
  basePrice: 35,
  price: 42,
  hasPriceOverride: true,
  isAvailable: false,
  isSold: true,
};

describe("locationCatalogStatus", () => {
  it("distingue los tres estados que le importan al owner", () => {
    expect(locationCatalogStatus({ isSold: true, isAvailable: true })).toBe("sold");
    expect(locationCatalogStatus({ isSold: true, isAvailable: false })).toBe("unavailable");
    expect(locationCatalogStatus({ isSold: false, isAvailable: true })).toBe("not-sold");
  });

  it("cada estado tiene su nombre", () => {
    expect(CATALOG_STATUS_LABELS.sold).toBe("Se vende acá");
    expect(CATALOG_STATUS_LABELS.unavailable).toBe("Agotado acá");
    expect(CATALOG_STATUS_LABELS["not-sold"]).toBe("No se vende acá");
  });
});

describe("describeLocationProductRow", () => {
  it("con precio propio muestra también el del negocio", () => {
    expect(describeLocationProductRow(item, { symbol: "C$", locale: "es-NI" })).toBe(
      "C$42.00 · base C$35.00",
    );
  });

  it("sin precio propio muestra un solo precio", () => {
    expect(
      describeLocationProductRow(
        { ...item, price: 35, hasPriceOverride: false },
        { symbol: "C$", locale: "es-NI" },
      ),
    ).toBe("C$35.00");
  });
});

describe("describeCatalogSummary", () => {
  it("resume el catálogo del local, no el del negocio", () => {
    expect(
      describeCatalogSummary({ total: 12, sold: 10, unavailable: 2, overridden: 3 }),
    ).toBe("12 productos · 10 en este local · 2 agotados · 3 con precio propio");
  });

  it("sin excepciones lo dice en una línea corta", () => {
    expect(describeCatalogSummary({ total: 5, sold: 5, unavailable: 0, overridden: 0 })).toBe(
      "5 productos · todos al precio del negocio",
    );
  });
});

describe("catalogItemToForm / catalogFormToInput", () => {
  it("abre el formulario con lo que está guardado", () => {
    expect(catalogItemToForm(item)).toEqual({
      priceOverride: "42",
      isAvailable: false,
      isActive: true,
    });
  });

  it("un precio vacío significa volver al precio base", () => {
    expect(
      catalogFormToInput({ ...createEmptyCatalogForm(), priceOverride: "  " }),
    ).toEqual({ priceOverride: null, isAvailable: true, isActive: true });
  });

  it("un precio escrito viaja como número", () => {
    expect(
      catalogFormToInput({ priceOverride: "39.5", isAvailable: false, isActive: true }),
    ).toEqual({ priceOverride: 39.5, isAvailable: false, isActive: true });
  });

  it("ida y vuelta sin perder nada", () => {
    expect(catalogFormToInput(catalogItemToForm(item))).toEqual({
      priceOverride: 42,
      isAvailable: false,
      isActive: true,
    });
  });
});
