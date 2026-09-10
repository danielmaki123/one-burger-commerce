import { describe, expect, it } from "vitest";

import { DEFAULT_CURRENCY_FORMAT } from "@/shared/lib/format-currency";

import {
  findPublicProductById,
  formatModifierOptionPrice,
  getProductDetailEyebrow,
} from "./product-detail-copy";

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

  it("usa un único precio visible por opción", () => {
    expect(formatModifierOptionPrice(425, DEFAULT_CURRENCY_FORMAT)).toBe("+C$425.00");
    expect(formatModifierOptionPrice(0, DEFAULT_CURRENCY_FORMAT)).toBe("C$0.00");
  });
});
