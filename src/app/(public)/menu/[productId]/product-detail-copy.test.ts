import { describe, expect, it } from "vitest";

import { findPublicProductById, getProductDetailEyebrow } from "./product-detail-copy";

describe("product-detail-copy", () => {
  it("deriva el eyebrow aprobado para cócteles desde la categoría pública", () => {
    const product = findPublicProductById(
      [
        {
          id: "cat-1",
          name: "Cocteles",
          products: [
            {
              id: "prod-1",
              name: "Sangría",
            },
          ],
          subcategories: [],
        },
      ],
      "prod-1",
    );

    expect(product).toMatchObject({
      id: "prod-1",
      categoryName: "Cocteles",
    });
    expect(getProductDetailEyebrow(product)).toBe("Cóctel de la casa");
  });
});
