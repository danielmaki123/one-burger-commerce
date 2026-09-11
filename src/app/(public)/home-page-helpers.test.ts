import { describe, expect, it } from "vitest";

import {
  getHomeBrandNameClassName,
  getHomeHeroFrameClassName,
  getHomeHeroLoadingClassName,
  getHomeHeroTitleClassName,
  getHomePageShellClassName,
  getHomePopularCtaClassName,
  normalizeHomeHeroDescription,
} from "./home-page-helpers";

describe("public home helpers", () => {
  it("uses a wider desktop shell for the public home page", () => {
    const className = getHomePageShellClassName();

    expect(className).toContain("max-w-6xl");
    expect(className).toContain("gap-5");
    expect(className).toContain("pb-10");
    expect(className).toContain("pt-4");
  });

  it("caps the home hero with explicit heights instead of oversized aspect ratios", () => {
    const className = getHomeHeroFrameClassName();
    const loadingClassName = getHomeHeroLoadingClassName();

    expect(className).toContain("h-[320px]");
    expect(className).toContain("sm:h-[420px]");
    expect(className).toContain("lg:h-[460px]");
    expect(className).not.toContain("aspect-[4/5]");

    expect(loadingClassName).toContain("h-[320px]");
    expect(loadingClassName).toContain("sm:h-[420px]");
    expect(loadingClassName).toContain("lg:h-[460px]");
    expect(loadingClassName).not.toContain("aspect-[4/5]");
  });

  it("el título del hero usa la escala del mock, no tamaños sueltos", () => {
    const className = getHomeHeroTitleClassName();

    // T1.3: los tamaños pasaron a ser tokens (30 px mobile / 40 px escritorio,
    // peso 800 y su interlineado), así que ya no hay valores arbitrarios acá.
    expect(className).toContain("text-display");
    expect(className).toContain("lg:text-display-lg");
    expect(className).not.toMatch(/text-\[\d/);
    expect(className).not.toContain("font-semibold");
    expect(className).toContain("max-w-full");
    expect(className).toContain("break-words");
  });

  it("el nombre del negocio en el encabezado usa el paso headline del mock", () => {
    const className = getHomeBrandNameClassName();

    expect(className).toContain("text-headline");
    expect(className).toContain("text-ink-green");
    expect(className).not.toContain("font-semibold");
  });

  it("uses a tactile plus CTA size for home popular cards", () => {
    const className = getHomePopularCtaClassName();

    expect(className).toContain("h-11");
    expect(className).toContain("w-11");
  });

  it("corrects the audited public hero accent without mutating marketing data", () => {
    expect(normalizeHomeHeroDescription("Para disfrutar mas la mesa")).toBe(
      "Para disfrutar más la mesa",
    );
  });
});
