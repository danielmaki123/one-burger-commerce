import { describe, expect, it, vi } from "vitest";

import { createInMemoryPosCatalog } from "./in-memory-pos-catalog";
import type { PosCatalogProduct, PosCatalogView } from "../ports/pos-catalog";

/**
 * TASK-301 — el doble del catálogo del mostrador.
 *
 * Implementa el **puerto completo** (regla de `AGENTS.md`): si mañana el puerto suma un método, el
 * compilador obliga a implementarlo acá también, y el test del caso de uso no queda midiendo un
 * doble incompleto.
 *
 * Devuelve la vista cargada por local y **copia** sus arreglos: la proyección de verdad se prueba en
 * `domain/pos-catalog-view.test.ts`.
 */

const taco: PosCatalogProduct = {
  id: "prod_taco",
  categoryId: "cat_tacos",
  subcategoryId: null,
  name: "Taco de birria",
  description: null,
  basePrice: 35,
  packagingFeeAmount: 0,
  images: [],
  availability: { isAvailable: true, isActive: true },
  modifierGroups: [],
  bundleRules: [],
  createdAt: new Date("2026-09-14T00:00:00.000Z"),
  updatedAt: new Date("2026-09-14T00:00:00.000Z"),
  requiresOptions: false,
  categoryName: "Tacos",
};

const combo: PosCatalogProduct = {
  ...taco,
  id: "prod_combo",
  name: "Combo",
  categoryId: "cat_combos",
  categoryName: "Combos",
  requiresOptions: true,
};

function view(products: PosCatalogProduct[]): PosCatalogView {
  return {
    products,
    categories: [{ id: products[0].categoryId, name: products[0].categoryName, count: products.length }],
    total: products.length,
    query: "",
  };
}

describe("catálogo del POS en memoria", () => {
  it("devuelve la vista del local pedido", async () => {
    const catalog = createInMemoryPosCatalog({
      loc_centro: view([taco]),
      loc_playa: view([combo]),
    });

    expect((await catalog.listCatalog({ locationId: "loc_centro", query: "" })).products).toEqual([
      taco,
    ]);
    expect((await catalog.listCatalog({ locationId: "loc_playa", query: "" })).products).toEqual([
      combo,
    ]);
  });

  it("un local sin catálogo devuelve una vista vacía, no un error", async () => {
    const catalog = createInMemoryPosCatalog({});

    expect(await catalog.listCatalog({ locationId: "loc_nuevo", query: "" })).toEqual({
      products: [],
      categories: [],
      total: 0,
      query: "",
    });
  });

  it("copia la lista: cambiar el arreglo original no cambia lo que devuelve", async () => {
    const original = view([taco]);
    const catalog = createInMemoryPosCatalog({ loc_centro: original });

    original.products.push(combo);

    expect((await catalog.listCatalog({ locationId: "loc_centro", query: "" })).products).toHaveLength(
      1,
    );
  });

  it("registra las llamadas, para poder afirmar que la pantalla pidió el catálogo una vez", async () => {
    const onList = vi.fn();
    const catalog = createInMemoryPosCatalog({ loc_centro: view([taco]) }, { onList });

    await catalog.listCatalog({ locationId: "loc_centro", query: "taco" });

    expect(onList).toHaveBeenCalledWith({ locationId: "loc_centro", query: "taco" });
  });
});
