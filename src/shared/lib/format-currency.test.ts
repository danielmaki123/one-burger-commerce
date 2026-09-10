import { describe, expect, it } from "vitest";

import { DEFAULT_BUSINESS_SETTINGS } from "@/modules/business-settings/domain/business-settings-defaults";
import { DEFAULT_CURRENCY_FORMAT, formatCurrency } from "./format-currency";

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

  it("takes the default format from the business settings defaults", () => {
    expect(DEFAULT_CURRENCY_FORMAT).toEqual({
      symbol: DEFAULT_BUSINESS_SETTINGS.currencySymbol,
      locale: DEFAULT_BUSINESS_SETTINGS.locale,
    });
  });

  it("uses the configured symbol and locale", () => {
    expect(formatCurrency(1246.5, { symbol: "US$", locale: "en-US" })).toBe("US$1,246.50");
    expect(formatCurrency(1246.5, { symbol: "€", locale: "es-ES" })).toBe("€1246,50");
  });
});
