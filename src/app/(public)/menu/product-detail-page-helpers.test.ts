import { describe, expect, it } from "vitest";

import { publicProductDetailScaleClasses } from "./product-detail-page-helpers";

describe("product-detail-page-helpers", () => {
  it("caps the PDP hero and heading within the approved scale", () => {
    expect(publicProductDetailScaleClasses.hero).toContain("h-[18rem]");
    expect(publicProductDetailScaleClasses.hero).toContain("sm:h-[20rem]");
    expect(publicProductDetailScaleClasses.hero).toContain("lg:h-[22.5rem]");

    expect(publicProductDetailScaleClasses.heading).toContain("text-[1.75rem]");
    expect(publicProductDetailScaleClasses.heading).toContain("sm:text-[2rem]");
    expect(publicProductDetailScaleClasses.heading).not.toContain("text-4xl");
  });

  it("keeps PDP actions tactile without shrinking the primary CTA", () => {
    expect(publicProductDetailScaleClasses.stepperButton).toContain("h-11");
    expect(publicProductDetailScaleClasses.stepperButton).toContain("w-11");
    expect(publicProductDetailScaleClasses.primaryCta).toContain("h-14");
  });

  it("reduces panel bulk without changing the transactional structure", () => {
    expect(publicProductDetailScaleClasses.surfaceCard).toContain("rounded-[28px]");
    expect(publicProductDetailScaleClasses.surfacePanel).toContain("rounded-[24px]");
    expect(publicProductDetailScaleClasses.surfacePanel).toContain("p-4");
  });
});
