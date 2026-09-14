import { describe, expect, it, vi } from "vitest";

import { createInMemoryPosCatalog } from "../../adapters/in-memory-pos-catalog";
import type { PosCatalogProduct } from "../../ports/pos-catalog";
import { searchPosCatalog } from "./search-pos-catalog";

/**
 * TASK-301 — la búsqueda del catálogo del mostrador.
 *
 * El cajero escribe lo que el cliente le dice ("taco", "birria", "refresco") y necesita ver las
 * coincidencias sin importar acentos ni mayúsculas. La normalización **no se reimplementa**: se usa
 * la misma que el menú público y la home (`src/shared/lib/normalize-search-text.ts`), porque dos
 * normalizaciones distintas dan resultados distintos para el mismo término.
 */

const product = (over: Partial<PosCatalogProduct>): PosCatalogProduct => ({
  id: "prod_x",
  name: "Producto",
  price: 35,
  categoryId: "cat_x",
  categoryName: "Categoría",
  requiresOptions: false,
  ...over,
});

const tacos = [
  product({ id: "prod_taco", name: "Taco de birria", categoryName: "Tacos" }),
  product({ id: "prod_taco_pollo", name: "Taco de pollo", categoryName: "Tacos" }),
  product({ id: "prod_refresco", name: "Refresco de cola", categoryName: "Bebidas", price: 25 }),
];

describe("búsqueda del catálogo del POS", () => {
  it("sin consulta devuelve el catálogo del local en su orden", async () => {
    const catalog = createInMemoryPosCatalog({ loc_centro: tacos });

    const result = await searchPosCatalog({ catalog, locationId: "loc_centro", query: "   " });

    expect(result.products.map((item) => item.id)).toEqual([
      "prod_taco",
      "prod_taco_pollo",
      "prod_refresco",
    ]);
    expect(result.total).toBe(3);
  });

  it("encuentra por nombre sin importar acentos ni mayúsculas", async () => {
    const catalog = createInMemoryPosCatalog({
      loc_centro: [product({ id: "prod_cafe", name: "Café con leche" })],
    });

    const conAcento = await searchPosCatalog({ catalog, locationId: "loc_centro", query: "café" });
    const sinAcento = await searchPosCatalog({ catalog, locationId: "loc_centro", query: "CAFE" });

    expect(conAcento.products.map((item) => item.id)).toEqual(["prod_cafe"]);
    expect(sinAcento.products.map((item) => item.id)).toEqual(["prod_cafe"]);
  });

  it("también encuentra por categoría, que es como el cajero busca grupales", async () => {
    const catalog = createInMemoryPosCatalog({ loc_centro: tacos });

    const result = await searchPosCatalog({ catalog, locationId: "loc_centro", query: "bebidas" });

    expect(result.products.map((item) => item.id)).toEqual(["prod_refresco"]);
  });

  it("cuenta las coincidencias y no cambia el total del catálogo", async () => {
    const catalog = createInMemoryPosCatalog({ loc_centro: tacos });

    const result = await searchPosCatalog({ catalog, locationId: "loc_centro", query: "taco" });

    expect(result.total).toBe(2);
    expect(result.query).toBe("taco");
  });

  it("sin coincidencias devuelve vacío, sin explotar", async () => {
    const catalog = createInMemoryPosCatalog({ loc_centro: tacos });

    const result = await searchPosCatalog({ catalog, locationId: "loc_centro", query: "sushi" });

    expect(result.products).toEqual([]);
    expect(result.total).toBe(0);
  });

  it("pide el catálogo del local una sola vez (el filtro es local, no una consulta por tecla)", async () => {
    const listProducts = vi.fn(async () => tacos);
    const catalog = { listProducts };

    await searchPosCatalog({ catalog, locationId: "loc_centro", query: "taco" });

    expect(listProducts).toHaveBeenCalledTimes(1);
    expect(listProducts).toHaveBeenCalledWith({ locationId: "loc_centro" });
  });
});
