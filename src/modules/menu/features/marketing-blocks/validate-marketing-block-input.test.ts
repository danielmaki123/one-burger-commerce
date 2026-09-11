import { describe, expect, it } from "vitest";

import { InMemoryMenuRepository } from "@/modules/menu/adapters/in-memory-menu-repository";
import { validateMarketingBlockInput } from "./validate-marketing-block-input";

describe("validateMarketingBlockInput", () => {
  it("rejects category CTA when target category is inactive", async () => {
    const repository = new InMemoryMenuRepository();
    repository.categories.push({
      id: "cat_1",
      name: "Oculta",
      slug: "oculta",
      sortOrder: 0,
      isActive: false,
      color: null,
      subcategories: [],
      products: [],
    });

    await expect(
      validateMarketingBlockInput(
        {
          type: "promo",
          title: "Promo",
          ctaLabel: "Ver",
          ctaType: "category",
          ctaTarget: "oculta",
          isActive: true,
          sortOrder: 0,
        },
        repository,
      ),
    ).rejects.toMatchObject({
      status: 404,
      code: "NOT_FOUND",
      fields: { ctaTarget: "Invalid category slug" },
    });
  });

  it("clears CTA fields when type is none", async () => {
    const repository = new InMemoryMenuRepository();

    const result = await validateMarketingBlockInput(
      {
        type: "info",
        title: "Solo info",
        ctaLabel: "No debe persistir",
        ctaType: "none",
        ctaTarget: "/menu/prod_1",
        isActive: true,
        sortOrder: 3,
      },
      repository,
    );

    expect(result.ctaLabel).toBeNull();
    expect(result.ctaTarget).toBeNull();
  });
});
