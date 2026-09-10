import { describe, expect, it } from "vitest";

import {
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

  it("keeps the home hero title within the approved heading band", () => {
    const className = getHomeHeroTitleClassName();

    expect(className).toContain("text-3xl");
    expect(className).toContain("sm:text-[2.25rem]");
    expect(className).toContain("lg:text-[2.5rem]");
    expect(className).not.toContain("sm:text-4xl");
    expect(className).toContain("max-w-full");
    expect(className).toContain("break-words");
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
