import { describe, expect, it } from "vitest";

import { getPublicStartingPrice } from "./public-product-pricing";

describe("getPublicStartingPrice", () => {
  it("includes the cheapest required option instead of presenting a zero base price", () => {
    expect(
      getPublicStartingPrice({
        basePrice: 0,
        modifierGroups: [
          {
            minSelections: 1,
            options: [
              { priceDelta: 425 },
              { priceDelta: 795 },
              { priceDelta: 185 },
            ],
          },
        ],
      }),
    ).toBe(185);
  });

  it("ignores inactive options when determining the minimum payable price", () => {
    expect(
      getPublicStartingPrice({
        basePrice: 0,
        modifierGroups: [
          {
            minSelections: 1,
            options: [
              { priceDelta: 0, isActive: false },
              { priceDelta: 185, isActive: true },
            ],
          },
        ],
      }),
    ).toBe(185);
  });

  it("adds the lowest valid combination for each required group", () => {
    expect(
      getPublicStartingPrice({
        basePrice: 290,
        modifierGroups: [
          {
            minSelections: 2,
            options: [
              { priceDelta: 70 },
              { priceDelta: 15 },
              { priceDelta: 35 },
            ],
          },
          {
            minSelections: 1,
            options: [{ priceDelta: 20 }],
          },
        ],
      }),
    ).toBe(360);
  });

  it("does not add optional groups or incomplete required configuration", () => {
    expect(
      getPublicStartingPrice({
        basePrice: 290,
        modifierGroups: [
          { minSelections: 0, options: [{ priceDelta: 250 }] },
          { minSelections: 2, options: [{ priceDelta: 20 }] },
        ],
      }),
    ).toBe(290);
  });
});
