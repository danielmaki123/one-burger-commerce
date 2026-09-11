import { describe, expect, it } from "vitest";

import {
  getPublicCheckoutMobileActionClassName,
  publicCheckoutScaleClasses,
} from "./checkout-scale-helpers";

describe("checkout-scale-helpers", () => {
  it("keeps checkout headings in the approved transactional band", () => {
    expect(publicCheckoutScaleClasses.pageHeading).toContain("text-[1.75rem]");
    expect(publicCheckoutScaleClasses.pageHeading).toContain("sm:text-[2rem]");
    expect(publicCheckoutScaleClasses.pageHeading).not.toContain("sm:text-4xl");
  });

  it("keeps the primary CTA tactile", () => {
    expect(publicCheckoutScaleClasses.primaryCta).toContain("h-14");
  });

  it("no disfraza el botón deshabilitado de habilitado", () => {
    // Cambio de contrato (TASK-checkout-ux): el CTA solo se deshabilita mientras envía,
    // así que no puede anular la señal visual de deshabilitado.
    expect(publicCheckoutScaleClasses.primaryCta).not.toContain("disabled:opacity-100");
    expect(publicCheckoutScaleClasses.primaryCta).not.toContain("disabled:bg-brand/55");
  });

  it("compacts checkout surfaces without touching the global layout width", () => {
    expect(publicCheckoutScaleClasses.formSection).toContain("rounded-[24px]");
    expect(publicCheckoutScaleClasses.layoutShell).toContain("max-w-6xl");
  });

  it("keeps the mobile checkout action above the global tab bar", () => {
    expect(getPublicCheckoutMobileActionClassName()).toContain("bottom-[calc(5.5rem+env(safe-area-inset-bottom))]");
  });
});
