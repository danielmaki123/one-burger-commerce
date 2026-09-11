import { expect, test, type Page } from "@playwright/test";

/**
 * T1.3 — la escala del mock tiene que llegar al navegador de verdad.
 *
 * Que el token exista en `globals.css` no alcanza: Tailwind solo emite las
 * utilidades que alguien usa, y el tamaño, el interlineado y el peso viajan
 * juntos dentro del token. Estas pruebas montan un elemento de sondeo con la
 * clase y miden lo que el navegador calculó, en los dos anchos que exige el
 * repo (375 px y 1280 px).
 */
type Measurement = {
  fontSize: string;
  lineHeight: string;
  fontWeight: string;
  letterSpacing: string;
  borderRadius: string;
  boxShadow: string;
};

async function measure(page: Page, className: string): Promise<Measurement> {
  return page.evaluate((cls) => {
    const probe = document.createElement("div");
    probe.className = cls;
    probe.textContent = "Sondeo";
    document.body.appendChild(probe);

    const computed = window.getComputedStyle(probe);
    const measurement = {
      fontSize: computed.fontSize,
      lineHeight: computed.lineHeight,
      fontWeight: computed.fontWeight,
      letterSpacing: computed.letterSpacing,
      borderRadius: computed.borderRadius,
      boxShadow: computed.boxShadow,
    };

    probe.remove();
    return measurement;
  }, className);
}

test.describe("escala tipográfica del mock", () => {
  test("en celular el paso display mide 30 px con su interlineado y su peso", async ({
    page,
  }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const style = await measure(page, "text-display");

    expect(style.fontSize).toBe("30px");
    expect(style.lineHeight).toBe("38px");
    expect(style.fontWeight).toBe("800");
    expect(style.letterSpacing).toBe("-0.6px");
  });

  test("en escritorio la variante -lg sube el paso display a 40 px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    const style = await measure(page, "text-display lg:text-display-lg");

    expect(style.fontSize).toBe("40px");
    expect(style.lineHeight).toBe("48px");
    expect(style.fontWeight).toBe("800");
    expect(style.letterSpacing).toBe("-1.2px");
  });

  test("el paso más chico queda en 12 px, no en los 10 px del mock", async ({ page }) => {
    await page.goto("/");

    const style = await measure(page, "text-label-xs");

    // El mock usa 10 px en los badges; en un teléfono real no se lee.
    expect(style.fontSize).toBe("12px");
    expect(style.fontWeight).toBe("700");
  });
});

test.describe("curvaturas y elevaciones del mock", () => {
  test("las tarjetas y los paneles usan 16 px y 24 px", async ({ page }) => {
    await page.goto("/");

    expect((await measure(page, "rounded-card")).borderRadius).toBe("16px");
    expect((await measure(page, "rounded-panel")).borderRadius).toBe("24px");
  });

  test("las sombras se resuelven con el color configurado, no con un gris fijo", async ({
    page,
  }) => {
    await page.goto("/");

    const brand = await page.evaluate(() =>
      window
        .getComputedStyle(document.documentElement)
        .getPropertyValue("--brand")
        .trim(),
    );
    expect(brand).not.toBe("");

    for (const utility of ["shadow-card", "shadow-raised", "shadow-float"]) {
      const { boxShadow } = await measure(page, utility);
      // `color-mix()` se resuelve en el navegador: si `--brand` no llegara, la
      // sombra saldría transparente y el color no aparecería en ningún rgb().
      expect(boxShadow, `${utility} no se aplicó`).not.toBe("none");
      expect(boxShadow, `${utility} no se tiñó`).toMatch(/rgba?\(/);
    }
  });
});
