import { describe, expect, it, vi } from "vitest";

import {
  InMemoryLocationRepository,
  createInMemoryLocation,
} from "@/modules/locations/adapters/in-memory-location-repository";
import { InMemoryMenuRepository } from "@/modules/menu/adapters/in-memory-menu-repository";

import { getCatalog } from "./get-catalog";

/**
 * El caso de uso único del catálogo, con sus dos alcances.
 *
 * Lo que fija: que la carta y el mostrador lean el **mismo** catálogo (mismo precio del local, mismas
 * excepciones de la sucursal) y que lo único que cambie sea el alcance — el mostrador ve también lo
 * agotado y no lee los bloques de marketing.
 */

function locationRepository() {
  return new InMemoryLocationRepository([
    createInMemoryLocation({ id: "loc_principal", name: "Principal" }),
  ]);
}

function conCategoria(repository: InMemoryMenuRepository) {
  repository.categories.push({
    id: "cat_1",
    name: "Tacos",
    slug: "tacos",
    sortOrder: 0,
    isActive: true,
    color: null,
    subcategories: [],
    products: [],
  });

  return repository;
}

describe("getCatalog — la carta pública", () => {
  it("mapea el CTA de los bloques de marketing activos a un href seguro", async () => {
    const repository = conCategoria(new InMemoryMenuRepository());
    await repository.createProduct({
      categoryId: "cat_1",
      name: "Combo de la casa",
      basePrice: 325,
      images: [],
      isAvailable: true,
      isActive: true,
    });
    repository.marketingBlocks.push(
      {
        id: "mkt_1",
        type: "combo",
        title: "Combo de la casa",
        description: "Disponible hoy",
        imageUrl: null,
        ctaLabel: "Ver combo",
        ctaType: "product",
        ctaTarget: repository.products[0].id,
        isActive: true,
        sortOrder: 2,
        startsAt: null,
        endsAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: "mkt_2",
        type: "featured",
        title: "Explora Tacos",
        description: null,
        imageUrl: null,
        ctaLabel: "Ir a categoría",
        ctaType: "category",
        ctaTarget: "tacos",
        isActive: true,
        sortOrder: 1,
        startsAt: null,
        endsAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    const result = await getCatalog(
      { scope: "public" },
      { repository, locationRepository: locationRepository() },
    );

    expect(result.marketingBlocks).toHaveLength(2);
    expect(result.marketingBlocks[0]).toMatchObject({
      id: "mkt_2",
      ctaType: "category",
      ctaHref: "/menu?category=tacos",
    });
    expect(result.marketingBlocks[1]).toMatchObject({
      id: "mkt_1",
      ctaType: "product",
      ctaHref: `/menu/${repository.products[0].id}`,
    });
  });

  it("cobra lo que cobra el local (T8)", async () => {
    const repository = conCategoria(new InMemoryMenuRepository());
    const product = await repository.createProduct({
      categoryId: "cat_1",
      name: "Taco de birria",
      basePrice: 35,
      images: [],
      isAvailable: true,
      isActive: true,
    });

    const locations = locationRepository();
    await locations.upsertLocationProduct({
      locationId: "loc_principal",
      productId: product.id,
      priceOverride: 42,
      isAvailable: true,
      isActive: true,
    });

    const result = await getCatalog(
      { scope: "public" },
      { repository, locationRepository: locations },
    );

    expect(result.categories[0].products[0].basePrice).toBe(42);
  });

  it("un plato que el local no vende no llega a ninguna de las dos superficies (T8)", async () => {
    const repository = conCategoria(new InMemoryMenuRepository());
    const product = await repository.createProduct({
      categoryId: "cat_1",
      name: "Taco de birria",
      basePrice: 35,
      images: [],
      isAvailable: true,
      isActive: true,
    });

    const locations = locationRepository();
    await locations.upsertLocationProduct({
      locationId: "loc_principal",
      productId: product.id,
      priceOverride: null,
      isAvailable: true,
      isActive: false,
    });

    const publico = await getCatalog(
      { scope: "public" },
      { repository, locationRepository: locations },
    );
    const pos = await getCatalog({ scope: "pos" }, { repository, locationRepository: locations });

    expect(publico.categories[0].products).toEqual([]);
    expect(pos.categories[0].products).toEqual([]);
  });
});

describe("getCatalog — el alcance del mostrador", () => {
  it("el mostrador ve el agotado y la carta no", async () => {
    const repository = conCategoria(new InMemoryMenuRepository());
    await repository.createProduct({
      categoryId: "cat_1",
      name: "Taco agotado",
      basePrice: 35,
      images: [],
      isAvailable: false,
      isActive: true,
    });

    const deps = { repository, locationRepository: locationRepository() };
    const publico = await getCatalog({ scope: "public" }, deps);
    const pos = await getCatalog({ scope: "pos" }, deps);

    expect(publico.categories[0].products).toEqual([]);
    expect(pos.categories[0].products.map((item) => item.name)).toEqual(["Taco agotado"]);
  });

  it("la carta puede pedir los agotados, el mostrador siempre los pide", async () => {
    const repository = conCategoria(new InMemoryMenuRepository());
    await repository.createProduct({
      categoryId: "cat_1",
      name: "Taco agotado",
      basePrice: 35,
      images: [],
      isAvailable: false,
      isActive: true,
    });

    const deps = { repository, locationRepository: locationRepository() };
    const carta = await getCatalog({ scope: "public", includeUnavailable: true }, deps);

    expect(carta.categories[0].products.map((item) => item.name)).toEqual(["Taco agotado"]);
  });

  it("los bloques de marketing son de la carta: el mostrador no los lee", async () => {
    const repository = conCategoria(new InMemoryMenuRepository());
    const spy = vi.spyOn(repository, "listPublicMarketingBlocks");

    const publico = await getCatalog(
      { scope: "public" },
      { repository, locationRepository: locationRepository() },
    );
    const pos = await getCatalog(
      { scope: "pos" },
      { repository, locationRepository: locationRepository() },
    );

    expect(publico.marketingBlocks).toEqual([]);
    expect(pos.marketingBlocks).toEqual([]);
    // Una sola lectura de bloques: la de la carta.
    expect(spy).toHaveBeenCalledTimes(1);
  });

  it("la búsqueda del mostrador filtra por producto y por categoría, y el caso de uso la aplica", async () => {
    const repository = conCategoria(new InMemoryMenuRepository());
    await repository.createProduct({
      categoryId: "cat_1",
      name: "Taco de birria",
      basePrice: 35,
      images: [],
      isAvailable: true,
      isActive: true,
    });
    await repository.createProduct({
      categoryId: "cat_1",
      name: "Cola",
      basePrice: 25,
      images: [],
      isAvailable: true,
      isActive: true,
    });

    const deps = { repository, locationRepository: locationRepository() };
    const porProducto = await getCatalog({ scope: "pos", query: "birria" }, deps);
    const porCategoria = await getCatalog({ scope: "pos", query: "tacos" }, deps);
    const sinNada = await getCatalog({ scope: "pos", query: "sushi" }, deps);

    expect(porProducto.categories[0].products.map((item) => item.name)).toEqual(["Taco de birria"]);
    expect(porCategoria.categories[0].products.map((item) => item.name)).toEqual([
      "Taco de birria",
      "Cola",
    ]);
    expect(sinNada).toMatchObject({ categories: [] });
  });

  it("le pasa al repositorio el filtro de categoría y la disponibilidad del alcance", async () => {
    const repository = conCategoria(new InMemoryMenuRepository());
    const spy = vi.spyOn(repository, "getPublicMenu");

    await getCatalog(
      { scope: "public", categorySlug: "tacos" },
      { repository, locationRepository: locationRepository() },
    );
    await getCatalog({ scope: "pos" }, { repository, locationRepository: locationRepository() });

    expect(spy).toHaveBeenNthCalledWith(1, { categorySlug: "tacos", includeUnavailable: false });
    expect(spy).toHaveBeenNthCalledWith(2, { categorySlug: undefined, includeUnavailable: true });
  });
});
