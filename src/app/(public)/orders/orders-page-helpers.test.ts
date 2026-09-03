import { describe, expect, it } from "vitest";

import { formatPublicOrderUpdatedAt } from "./orders-page-helpers";

describe("formatPublicOrderUpdatedAt", () => {
  it("formats order dates in the Nicaraguan Spanish locale", () => {
    expect(formatPublicOrderUpdatedAt("2026-06-28T17:42:00.000Z")).toBe(
      "28/6/2026, 11:42 a. m.",
    );
  });
});
