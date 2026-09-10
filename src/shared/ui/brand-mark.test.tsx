import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

import { BrandMark } from "@/shared/ui/brand-mark";

const ISOTIPO = "https://cdn.test/isotipo.png";
const LOGO_COMPLETO = "https://cdn.test/logo.png";

describe("BrandMark", () => {
  it("usa el isotipo configurado en la marca corta", () => {
    const html = renderToStaticMarkup(
      createElement(BrandMark, {
        brand: { name: "One Burger", logoUrl: LOGO_COMPLETO, logoMarkUrl: ISOTIPO },
      }),
    );

    expect(html).toContain(`src="${ISOTIPO}"`);
    expect(html).not.toContain(">OB<");
  });

  it("usa el logo completo en la marca larga", () => {
    const html = renderToStaticMarkup(
      createElement(BrandMark, {
        brand: { name: "One Burger", logoUrl: LOGO_COMPLETO, logoMarkUrl: ISOTIPO },
        variant: "full",
      }),
    );

    expect(html).toContain(`src="${LOGO_COMPLETO}"`);
  });

  it("cae a las iniciales cuando todavia no hay logo", () => {
    const html = renderToStaticMarkup(
      createElement(BrandMark, {
        brand: { name: "One Burger", logoUrl: null, logoMarkUrl: null },
      }),
    );

    expect(html).toContain(">OB<");
    expect(html).not.toContain("<img");
  });

  it("respeta las clases de cada superficie", () => {
    const withLogo = renderToStaticMarkup(
      createElement(BrandMark, {
        brand: { name: "One Burger", logoUrl: null, logoMarkUrl: ISOTIPO },
        className: "h-11 w-11 rounded-xl",
      }),
    );
    const withoutLogo = renderToStaticMarkup(
      createElement(BrandMark, {
        brand: { name: "One Burger", logoUrl: null, logoMarkUrl: null },
        fallbackClassName: "h-10 w-10 rounded-xl bg-brand",
      }),
    );

    expect(withLogo).toContain('class="h-11 w-11 rounded-xl"');
    expect(withoutLogo).toContain('class="h-10 w-10 rounded-xl bg-brand"');
  });
});
