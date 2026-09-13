import { describe, expect, it } from "vitest";

import {
  getPublicFooterClassName,
  getPublicHeaderClassName,
  getPublicMobileInfoFooterClassName,
  shouldRenderPublicMobileBottomNav,
} from "./public-layout-helpers";

describe("public layout helpers", () => {
  /**
   * A-08 — **cambio de contrato**: antes el header era `hidden … md:block` y por debajo de `md` la
   * marca (isotipo + nombre) no existía. El owner pidió que se mantenga en las secciones
   * principales, así que ahora se dibuja en todos los anchos. El caso se reescribe por eso, no
   * para que pase: la visibilidad real la mide `tests/e2e/public-header.spec.ts` en el navegador.
   */
  it("keeps the public header visible at every width", () => {
    const className = getPublicHeaderClassName();

    expect(className).not.toContain("hidden");
    expect(className).toContain("sticky");
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
