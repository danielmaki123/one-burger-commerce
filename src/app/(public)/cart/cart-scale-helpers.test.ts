import { describe, expect, it } from "vitest";

import { publicCartScaleClasses } from "./cart-scale-helpers";

describe("cart-scale-helpers", () => {
  it("keeps the cart heading in the approved transactional scale", () => {
    expect(publicCartScaleClasses.heading).toContain("text-[1.75rem]");
    expect(publicCartScaleClasses.heading).toContain("sm:text-[2rem]");
    expect(publicCartScaleClasses.heading).not.toContain("sm:text-4xl");
  });

  it("raises cart steppers to the minimum tactile target", () => {
    expect(publicCartScaleClasses.stepperButton).toContain("h-11");
    expect(publicCartScaleClasses.stepperButton).toContain("w-11");
  });

  it("keeps the summary CTA at the approved primary action height", () => {
    expect(publicCartScaleClasses.summaryPrimaryCta).toContain("h-12");
  });
});
