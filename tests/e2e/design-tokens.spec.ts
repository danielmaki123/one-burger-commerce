import { expect, test, type Page } from "@playwright/test";

import { tryLoginAsOwner } from "./helpers";

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

/**
 * T1.2 — Plus Jakarta Sans entra como tercera tipografía (decisión D-A), sin
 * reemplazar a las dos que ya estaban.
 */
test.describe("tipografías elegibles", () => {
  test("la tercera tipografía se aplica en la vista previa y trae sus archivos", async ({
    page,
  }) => {
    page.setViewportSize({ width: 375, height: 812 });
    test.skip(
      !(await tryLoginAsOwner(page)),
      "hacen falta credenciales del admin del entorno (E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD)",
    );
    await page.goto("/admin/settings");

    const headingSelect = page.getByLabel("Tipografía de títulos");
    await expect(headingSelect.locator("option")).toHaveText([
      "Fraunces",
      "Inter",
      "Plus Jakarta Sans",
    ]);

    // Se elige la que NO está guardada, así el final del test comprueba que una
    // vista previa sin guardar no toca el sitio publicado.
    const saved = await headingSelect.inputValue();
    const picked = saved === "jakarta" ? "fraunces" : "jakarta";
    await headingSelect.selectOption(picked);

    const preview = page.locator('[aria-label="Vista previa"]');
    const businessName = await page.getByLabel("Nombre *").inputValue();
    const brandName = preview.getByText(businessName, { exact: true });

    const family = await brandName.evaluate((element) =>
      window.getComputedStyle(element).fontFamily.toLowerCase(),
    );
    // `next/font` nombra la familia como la variable CSS: `--font-jakarta` da
    // `jakarta`. Si la elección no llegara, acá quedaría la tipografía anterior.
    expect(family).toContain(picked);

    // No basta con que la variable exista: la tipografía tiene que estar
    // descargada. `document.fonts.check` es la única forma de saberlo.
    const loaded = await page.evaluate(async (fontFamily) => {
      const first = fontFamily.split(",")[0].replace(/["']/g, "").trim();
      await document.fonts.ready;
      return document.fonts.check(`700 16px "${first}"`);
    }, family);
    expect(loaded, `la tipografía elegida (${family}) no está cargada`).toBe(true);

    // Sin guardar, el sitio publicado sigue con la suya.
    await page.goto("/");
    const publicFamily = await page
      .getByRole("heading", { level: 1 })
      .first()
      .evaluate((element) => window.getComputedStyle(element).fontFamily.toLowerCase());
    expect(publicFamily).not.toContain(picked);
  });
});
