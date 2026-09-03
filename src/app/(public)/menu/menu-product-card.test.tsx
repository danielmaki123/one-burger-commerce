import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";

describe("MenuProductCard", () => {
  it("renders the compact browse card with image, price, name and plus only", async () => {
    const mod = await import("./menu-product-card").catch(() => null);

    expect(mod).not.toBeNull();
    if (!mod) return;

    const html = renderToStaticMarkup(
      createElement(mod.MenuProductCard, {
        product: {
          id: "prod-1",
          name: "Sangría",
          description: "Sangría en copa.",
          basePrice: 0,
          images: [
            {
              url: "https://images.casaantiguanic.com/img/13a961be-17f9-491a-afbd-d6af10ca8687.jpg",
              alt: "Sangría",
            },
          ],
          modifierGroups: [
            {
              minSelections: 1,
              options: [{ priceDelta: 185, isActive: true }],
            },
          ],
        },
      }),
    );

    expect(html).toContain("Sangría");
    expect(html).toContain("C$185.00");
    expect(html).toContain(">+</span>");
    expect(html).toContain("space-y-2");
    expect(html).toContain("line-clamp-2 text-base font-semibold leading-tight text-foreground");
    expect(html).toContain("flex items-center justify-between gap-2");
    expect(html).toContain("flex h-8 w-8 items-center justify-center rounded-xl");
    expect(html).toContain("text-sm font-bold leading-none text-foreground");
    expect(html).not.toContain("from-stone-950/40");
    expect(html).not.toContain("Desde");
    expect(html).not.toContain("Sangría en copa.");
    expect(html).not.toContain("Ver detalle");
    expect(html).not.toContain("Tocá para ver opciones");
    expect(html).not.toContain("rounded-full bg-card/94");
    expect(html).not.toContain("border-[3px] border-white/90 bg-brand");
    expect(html).not.toContain("flex items-start justify-between gap-2");
    expect(html).not.toContain("flex h-9 w-9 items-center justify-center rounded-2xl");
  });
});
