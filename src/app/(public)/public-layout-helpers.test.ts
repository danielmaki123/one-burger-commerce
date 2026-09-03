import { describe, expect, it } from "vitest";

import {
  getPublicFooterClassName,
  getPublicHeaderClassName,
  getPublicMobileInfoFooterClassName,
  shouldRenderPublicMobileBottomNav,
} from "./public-layout-helpers";

describe("public layout helpers", () => {
  it("hides the global public header on mobile and keeps it on desktop", () => {
    const className = getPublicHeaderClassName();

    expect(className).toContain("hidden");
    expect(className).toContain("md:block");
  });

  it("hides the informational public footer on mobile", () => {
    expect(getPublicMobileInfoFooterClassName()).toBe("hidden");
    expect(getPublicFooterClassName()).toContain("hidden");
    expect(getPublicFooterClassName()).toContain("md:block");
  });

  it("keeps the mobile tab bar on public flows that do not own a fixed product CTA", () => {
    expect(shouldRenderPublicMobileBottomNav("/")).toBe(true);
    expect(shouldRenderPublicMobileBottomNav("/cart")).toBe(true);
    expect(shouldRenderPublicMobileBottomNav("/checkout")).toBe(true);
    expect(shouldRenderPublicMobileBottomNav("/orders")).toBe(true);
    expect(shouldRenderPublicMobileBottomNav("/menu/aperol-spritz")).toBe(false);
  });
});
