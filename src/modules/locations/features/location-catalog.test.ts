import { describe, expect, it } from "vitest";

import {
  InMemoryLocationRepository,
  createInMemoryLocation,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { InMemoryMenuRepository } from "@/modules/menu/adapters/in-memory-menu-repository";
import { listLocationCatalog } from "@/modules/locations/features/list-location-catalog/list-location-catalog";
import { setLocationProduct } from "@/modules/locations/features/set-location-product/set-location-product";

/**
 * T8 fase 4 — el catálogo por local, del lado del servidor.
 *
 * El local no guarda una copia del menú: guarda **excepciones** (precio propio, agotado, no
 * lo vendo). Así un negocio de un solo local no configura nada y un producto nuevo se vende
 * en todos lados.
 */
function locations() {
  return new InMemoryLocationRepository([
    createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
    createInMemoryLocation({ id: "loc_norte", name: "Norte", slug: "norte", sortOrder: 1 }),
  ]);
}

async function menuWithProduct(price = 35) {
  const menu = new InMemoryMenuRepository();
  const category = await menu.createCategory({
    name: "Tacos",
    slug: "tacos",
    sortOrder: 0,
    isActive: true,
  });
  const product = await menu.createProduct({
    categoryId: category.id,
    name: "Taco de birria",
    basePrice: price,
    images: [],
    isAvailable: true,
    isActive: true,
  });

  return { menu, product };
}

describe("listLocationCatalog", () => {
  it("sin excepciones, el local vende todo al precio base", async () => {
    const { menu, product } = await menuWithProduct(35);

    const result = await listLocationCatalog("loc_norte", {
      locationRepository: locations(),
      menuRepository: menu,
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      productId: product.id,
      name: "Taco de birria",
      basePrice: 35,
      price: 35,
      hasPriceOverride: false,
      isAvailable: true,
      isSold: true,
    });
  });

  it("con precio propio, el precio del local gana", async () => {
    const { menu, product } = await menuWithProduct(35);
    const locationRepository = locations();
    await locationRepository.upsertLocationProduct({
      locationId: "loc_norte",
      productId: product.id,
      priceOverride: 40,
      isAvailable: true,
      isActive: true,
    });

    const result = await listLocationCatalog("loc_norte", {
      locationRepository,
      menuRepository: menu,
    });

    expect(result.data[0]).toMatchObject({ basePrice: 35, price: 40, hasPriceOverride: true });
  });

  it("un local puede tener el producto agotado sin dejar de venderlo", async () => {
    const { menu, product } = await menuWithProduct();
    const locationRepository = locations();
    await locationRepository.upsertLocationProduct({
      locationId: "loc_norte",
      productId: product.id,
      priceOverride: null,
      isAvailable: false,
      isActive: true,
    });

    const result = await listLocationCatalog("loc_norte", {
      locationRepository,
      menuRepository: menu,
    });

    expect(result.data[0]).toMatchObject({ isSold: true, isAvailable: false });
  });

  it("una excepción de otro local no cambia este local", async () => {
    const { menu, product } = await menuWithProduct(35);
    const locationRepository = locations();
    await locationRepository.upsertLocationProduct({
      locationId: "loc_principal",
      productId: product.id,
      priceOverride: 99,
      isAvailable: false,
      isActive: false,
    });

    const result = await listLocationCatalog("loc_norte", {
      locationRepository,
      menuRepository: menu,
    });

    expect(result.data[0]).toMatchObject({ price: 35, isAvailable: true, isSold: true });
  });

  it("el resumen cuenta el catálogo del local, no el del negocio", async () => {
    const { menu, product } = await menuWithProduct();
    const locationRepository = locations();
    await locationRepository.upsertLocationProduct({
      locationId: "loc_norte",
      productId: product.id,
      priceOverride: 40,
      isAvailable: false,
      isActive: true,
    });

    const result = await listLocationCatalog("loc_norte", {
      locationRepository,
      menuRepository: menu,
    });

    expect(result.meta).toMatchObject({ total: 1, sold: 1, unavailable: 1, overridden: 1 });
    // El local viaja con el catálogo: la pantalla no tiene que pedirlo de nuevo.
    expect(result.meta.location).toEqual({ id: "loc_norte", name: "Norte" });
  });

  it("un local que no existe se rechaza", async () => {
    const { menu } = await menuWithProduct();

    await expect(
      listLocationCatalog("loc_fantasma", {
        locationRepository: locations(),
        menuRepository: menu,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});

describe("setLocationProduct", () => {
  it("guarda la excepción del local", async () => {
    const { menu, product } = await menuWithProduct();
    const locationRepository = locations();

    const result = await setLocationProduct(
      "loc_norte",
      product.id,
      { priceOverride: 39.5, isAvailable: false, isActive: true },
      { locationRepository, menuRepository: menu },
    );

    expect(result.data).toMatchObject({
      locationId: "loc_norte",
      productId: product.id,
      priceOverride: 39.5,
      isAvailable: false,
    });
  });

  it("vuelve al precio base borrando la excepción", async () => {
    const { menu, product } = await menuWithProduct();
    const locationRepository = locations();
    await setLocationProduct(
      "loc_norte",
      product.id,
      { priceOverride: 40, isAvailable: true, isActive: true },
      { locationRepository, menuRepository: menu },
    );

    await setLocationProduct(
      "loc_norte",
      product.id,
      { priceOverride: null, isAvailable: true, isActive: true },
      { locationRepository, menuRepository: menu },
    );

    expect(await locationRepository.findLocationProduct("loc_norte", product.id)).toBeNull();
  });

  it("rechaza un precio negativo, campo por campo", async () => {
    const { menu, product } = await menuWithProduct();

    await expect(
      setLocationProduct(
        "loc_norte",
        product.id,
        { priceOverride: -5, isAvailable: true, isActive: true },
        { locationRepository: locations(), menuRepository: menu },
      ),
    ).rejects.toMatchObject({
      status: 422,
      fields: { priceOverride: expect.stringContaining("negativo") },
    });
  });

  it("un local o un producto que no existen se rechazan", async () => {
    const { menu, product } = await menuWithProduct();
    const locationRepository = locations();

    await expect(
      setLocationProduct(
        "loc_fantasma",
        product.id,
        { priceOverride: null, isAvailable: true, isActive: true },
        { locationRepository, menuRepository: menu },
      ),
    ).rejects.toMatchObject({ status: 404 });

    await expect(
      setLocationProduct(
        "loc_norte",
        "prod_fantasma",
        { priceOverride: null, isAvailable: true, isActive: true },
        { locationRepository, menuRepository: menu },
      ),
    ).rejects.toMatchObject({ status: 404 });
  });
});
