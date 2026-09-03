import { describe, expect, it } from "vitest";

import { formatCurrency } from "./format-currency";

describe("formatCurrency", () => {
  it("formats amounts with the C$ prefix and two decimals", () => {
    expect(formatCurrency(655.95)).toBe("C$655.95");
    expect(formatCurrency(0)).toBe("C$0.00");
    expect(formatCurrency(220)).toBe("C$220.00");
  });

  it("adds thousands separators", () => {
    expect(formatCurrency(1246)).toBe("C$1,246.00");
    expect(formatCurrency(14830.5)).toBe("C$14,830.50");
  });

  it("falls back to zero for non-finite amounts", () => {
    expect(formatCurrency(Number.NaN)).toBe("C$0.00");
    expect(formatCurrency(Number.POSITIVE_INFINITY)).toBe("C$0.00");
  });
});
