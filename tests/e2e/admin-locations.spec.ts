import { expect, test, type Page } from "@playwright/test";

import { loginAsOwner } from "./helpers";

/**
 * T8 fase 3 — la pantalla de locales, de punta a punta.
 *
 * El owner crea un local, lo ve en la lista y lo borra. Es el recorrido que antes no existía:
 * hasta ahora los locales solo se podían crear por API. El test deja la base como la
 * encontró (borra lo que creó).
 */
const NAME = "Local de prueba E2E";

async function deleteLocationIfPresent(page: Page) {
  await page.goto("/admin/locations");

  const row = page.getByRole("button", { name: `Editar local ${NAME}` });
  // La lista llega por fetch: sin esperar, una corrida anterior deja el local y el alta
  // siguiente no falla (no hay slug único repetido si cambio el nombre), pero el borrado
  // final podría intentar dos veces.
  await expect(page.getByText("Cargando locales…")).toBeHidden();
  if ((await row.count()) === 0) return;

  await row.first().click();
  page.once("dialog", (dialog) => void dialog.accept());
  await page.getByRole("button", { name: `Eliminar local ${NAME}` }).click();
  await expect(page.getByText("Local borrado.")).toBeVisible();
}

test.describe("locales del admin", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("el owner crea un local, lo ve listado y lo borra", async ({ page }) => {
    await loginAsOwner(page);
    await deleteLocationIfPresent(page);

    // 1) Se entra desde la navegación, no por URL directa.
    await page.getByRole("button", { name: "Más" }).click();
    await page.getByRole("link", { name: /Locales/ }).click();
    await expect(page.getByRole("heading", { name: "Locales" })).toBeVisible();

    // El local primario lo creó la migración: la pantalla nunca arranca vacía.
    await expect(page.getByRole("button", { name: "Editar local Principal" })).toBeVisible();

    // 2) Crear.
    await page.getByRole("button", { name: "Nuevo local" }).click();
    await page.getByLabel("Nombre").fill(NAME);
    await page.getByLabel("Identificador para la URL").fill("prueba-e2e");
    await page.getByLabel("Ciudad").fill("Diriamba");
    await page.getByLabel("Minutos de preparación").fill("30");
    await page.getByRole("button", { name: "Crear local" }).click();

    await expect(page.getByText("Local creado.")).toBeVisible();
    const row = page.getByRole("button", { name: `Editar local ${NAME}` });
    await expect(row).toBeVisible();
    await expect(row).toContainText("Diriamba");
    await expect(row).toContainText("preparación 30 min");

    // El formulario avisa si el identificador ya está en uso.
    await page.getByRole("button", { name: "Nuevo local" }).click();
    await page.getByLabel("Nombre").fill("Otro local");
    await page.getByLabel("Identificador para la URL").fill("prueba-e2e");
    await page.getByRole("button", { name: "Crear local" }).click();
    await expect(page.getByText("Revisá los campos marcados.")).toBeVisible();
    await expect(page.getByText(/Ya hay un local con el identificador/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();

    // 3) Borrar: el último local activo no se puede borrar, el nuevo sí.
    await row.click();
    // `window.confirm` del borrado: Playwright lo descarta por defecto.
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: `Eliminar local ${NAME}` }).click();
    await expect(page.getByText("Local borrado.")).toBeVisible();
    await expect(page.getByRole("button", { name: `Editar local ${NAME}` })).toHaveCount(0);

    // 4) Y el primario, que es el único que queda, se rechaza con el motivo.
    await page.getByRole("button", { name: "Editar local Principal" }).click();
    page.once("dialog", (dialog) => void dialog.accept());
    await page.getByRole("button", { name: "Eliminar local Principal" }).click();
    await expect(page.getByText(/necesita al menos un local|último local activo/)).toBeVisible();
    await page.getByRole("button", { name: "Cancelar" }).click();

    // La pantalla entra en 375 px sin scroll horizontal.
    const horizontalOverflow = await page.evaluate(
      () => document.documentElement.scrollWidth - window.innerWidth,
    );
    expect(horizontalOverflow).toBeLessThanOrEqual(1);
  });
});
