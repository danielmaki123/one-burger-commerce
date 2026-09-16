import { expect, test, type Page } from "@playwright/test";

import { tryLoginAsOwner } from "./helpers";

/**
 * La escala tipográfica del **ADN vigente** (`DESIGN_REFERENCES.md` §3 Patrón 5) tiene que llegar al
 * navegador de verdad.
 *
 * Que el token exista en `globals.css` no alcanza: Tailwind solo emite las utilidades que alguien usa,
 * y el tamaño, el interlineado y el peso viajan juntos dentro del token. Estas pruebas montan un
 * elemento de sondeo con la clase y miden lo que el navegador calculó, en los dos anchos que exige el
 * repo (375 px y 1280 px).
 *
 * **Cambio de contrato (2026-09-15)**: este archivo medía la escala del mock "Artisanal Appetite"
 * (display 30 px en celular, 40 px en escritorio, weight 800 y el paso más chico en 12 px). El owner
 * reemplazó ese ADN por el de `DESIGN_REFERENCES.md`: Hero **56 px** weight **700** en los dos anchos,
 * Label **11 px** y caption 12 px. Los números de acá son los del ADN nuevo; los del mock quedaron
 * viejos y por eso el spec fallaba.
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

/** El valor de un token de `@theme`, leído del documento (no de un archivo). */
async function themeToken(page: Page, name: string): Promise<string> {
  return page.evaluate(
    (token) =>
      window.getComputedStyle(document.documentElement).getPropertyValue(token).trim(),
    name,
  );
}

/** `-1.68px` → `-1.68`, para comparar con tolerancia en vez de exigir el string exacto. */
function px(value: string): number {
  return Number.parseFloat(value);
}

test.describe("escala tipográfica del ADN", () => {
  test("el hero mide 56 px en celular, con su interlineado y su peso", async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto("/");

    const style = await measure(page, "text-display");

    expect(style.fontSize).toBe("56px");
    expect(style.lineHeight).toBe("60px");
    expect(style.fontWeight).toBe("700");
    expect(px(style.letterSpacing)).toBeCloseTo(-1.68, 1);
  });

  test("en escritorio el hero sigue en 56 px y el Título mide 20 px", async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto("/");

    // El mock subía el hero a 40 px por breakpoint; el ADN fija el Hero en 56 px y deja
    // `text-display-lg` como alias del mismo paso (la home pública lo usa en `lg:`).
    const hero = await measure(page, "text-display lg:text-display-lg");
    expect(hero.fontSize).toBe("56px");
    expect(hero.fontWeight).toBe("700");

    const headline = await measure(page, "text-headline");
    expect(headline.fontSize).toBe("20px");
    expect(headline.lineHeight).toBe("26px");
    expect(headline.fontWeight).toBe("600");
  });

  test("el paso más chico es el Label del ADN (11 px) y el metadato queda en 12 px", async ({
    page,
  }) => {
    await page.goto("/");

    const label = await measure(page, "text-label-xs");
    expect(label.fontSize).toBe("11px");
    expect(label.fontWeight).toBe("700");
    expect(px(label.letterSpacing)).toBeCloseTo(0.88, 1);

    // El ADN pide 11 px para los metadatos; el caption sube a 12 px porque a 11 px no se lee en un
    // teléfono real. Es la única desviación del documento y está declarada en `globals.css`.
    const caption = await measure(page, "text-caption");
    expect(caption.fontSize).toBe("12px");
  });

  test("los nombres viejos apuntan a los tokens del ADN (el puente del modo oscuro)", async ({
    page,
  }) => {
    await page.goto("/");

    // Los 8 tokens del ADN todavía no tienen consumidor directo: Tailwind no emite `bg-success-soft`
    // porque ninguna pantalla la usa (los paneles siguen con los alias viejos, que son ~220 clases), y
    // `text-kpi` no lo usa nadie (los números grandes van en `text-3xl` hasta la Capa 1.6). Lo que sí
    // se puede —y se debe— verificar en el navegador es el **puente**: el alias vale lo mismo que el
    // `-soft`/`-strong` nuevo. Si ese puente se rompe, el modo oscuro deja de arreglar esas 220 clases.
    for (const [alias, target] of [
      ["--danger", "--danger-soft"],
      ["--success", "--success-soft"],
      ["--warning", "--warning-soft"],
      ["--danger-foreground", "--danger-strong"],
      ["--warning-foreground", "--warning-strong"],
      ["--success-foreground", "--success-strong"],
    ]) {
      const value = await themeToken(page, alias);

      expect(value, `${alias} no está declarado`).not.toBe("");
      expect(value, `${alias} dejó de apuntar a ${target}`).toBe(await themeToken(page, target));
    }
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
