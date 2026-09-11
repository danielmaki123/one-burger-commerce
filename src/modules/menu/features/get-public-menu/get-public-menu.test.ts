import { describe, expect, it } from "vitest";

import { InMemoryMenuRepository } from "@/modules/menu/adapters/in-memory-menu-repository";
import { getPublicMenu } from "./get-public-menu";

describe("getPublicMenu", () => {
  it("maps active marketing block CTAs to safe public hrefs", async () => {
    const repository = new InMemoryMenuRepository();
    repository.categories.push({
      id: "cat_1",
      name: "Maki Maki",
      slug: "maki-maki",
      sortOrder: 0,
      isActive: true,
      color: null,
      subcategories: [],
      products: [],
    });
    repository.products.push({
      id: "prod_1",
      categoryId: "cat_1",
      subcategoryId: null,
      name: "Combo de la casa",
      description: null,
      basePrice: 325,
      packagingFeeAmount: null,
      images: [],
      availability: { isAvailable: true, isActive: true },
      modifierGroups: [],
      bundleRules: [],
      createdAt: new Date(),
      updatedAt: new Date(),
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
        ctaTarget: "prod_1",
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
        title: "Explora Maki Maki",
        description: null,
        imageUrl: null,
        ctaLabel: "Ir a categoría",
        ctaType: "category",
        ctaTarget: "maki-maki",
        isActive: true,
        sortOrder: 1,
        startsAt: null,
        endsAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    );

    const result = await getPublicMenu({}, { repository });

    expect(result.marketingBlocks).toHaveLength(2);
    expect(result.marketingBlocks[0]).toMatchObject({
      id: "mkt_2",
      ctaType: "category",
      ctaHref: "/menu?category=maki-maki",
    });
    expect(result.marketingBlocks[1]).toMatchObject({
      id: "mkt_1",
      ctaType: "product",
      ctaHref: "/menu/prod_1",
    });
  });
});
