import { describe, expect, it, vi } from "vitest";

import { createInMemoryPosCatalog } from "./in-memory-pos-catalog";
import type { PosCatalogProduct } from "../ports/pos-catalog";

/**
 * TASK-301 — el doble del catálogo del mostrador.
 *
 * Implementa el **puerto completo** (regla de `AGENTS.md`): si mañana el puerto suma un método, el
 * compilador obliga a implementarlo acá también, y el test del caso de uso no queda midiendo un
 * doble incompleto.
 */

const taco: PosCatalogProduct = {
  id: "prod_taco",
  name: "Taco de birria",
  price: 35,
  categoryId: "cat_tacos",
  categoryName: "Tacos",
  requiresOptions: false,
};

const combo: PosCatalogProduct = {
  id: "prod_combo",
  name: "Combo",
  price: 90,
  categoryId: "cat_combos",
  categoryName: "Combos",
  requiresOptions: true,
};

describe("catálogo del POS en memoria", () => {
  it("devuelve solo los productos del local pedido", async () => {
    const catalog = createInMemoryPosCatalog({
      loc_centro: [taco],
      loc_playa: [combo],
    });

    expect(await catalog.listProducts({ locationId: "loc_centro" })).toEqual([taco]);
    expect(await catalog.listProducts({ locationId: "loc_playa" })).toEqual([combo]);
  });

  it("un local sin catálogo devuelve una lista vacía, no un error", async () => {
    const catalog = createInMemoryPosCatalog({});

    expect(await catalog.listProducts({ locationId: "loc_nuevo" })).toEqual([]);
  });

  it("copia la lista: cambiar el arreglo original no cambia lo que devuelve", async () => {
    const original = [taco];
    const catalog = createInMemoryPosCatalog({ loc_centro: original });

    original.push(combo);

    expect(await catalog.listProducts({ locationId: "loc_centro" })).toHaveLength(1);
  });

  it("registra las llamadas, para poder afirmar que el caso de uso pidió el catálogo una vez", async () => {
    const listProducts = vi.fn();
    const catalog = createInMemoryPosCatalog({ loc_centro: [taco] }, { onList: listProducts });

    await catalog.listProducts({ locationId: "loc_centro" });

    expect(listProducts).toHaveBeenCalledWith({ locationId: "loc_centro" });
  });
});
