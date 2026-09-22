import { expect, test } from "@playwright/test";

import { loginAsOwner, mutationsAllowed } from "./helpers";

/**
 * Fase 3 del rediseño de Caja (2026-09-23) — el **cuadre por banco**, de punta a punta.
 *
 * El caso es el que importa de la fase: el dueño carga los bancos con los que liquida la sucursal, el
 * cierre pide el lote de la terminal y **el número queda en el documento** (el detalle del cierre y la hoja
 * que se firma). Lo que se verifica en navegador real y no en la unidad es el recorrido completo: Config de
 * Caja guarda el catálogo (`PUT /api/admin/cash/banks`), la Caja de esa sucursal baja los bancos como dato
 * (la API del catálogo es del dueño), el modal del cierre arma el cuadre y
 * `POST /api/admin/pos/shift/close` lo firma.
 *
 * Deja el estado ordenado: el turno queda **cerrado** y el banco del E2E queda **apagado** (no se borra: un
 * cierre ya lo referencia y el `onDelete: Restrict` de la base no lo permitiría).
 */

const BANK_NAME = "Banco E2E cuadre";
const LOTE = "E2E-001";

test.describe("cierre por banco", () => {
  test("el dueño carga el banco, lo declara al cerrar y el cuadre queda en el detalle", async ({
    page,
  }) => {
    test.skip(!mutationsAllowed, "Guardar el catálogo y cerrar la caja tocan la base.");

    await loginAsOwner(page);

    // 1. El catálogo: el banco del E2E, asignado a la primera sucursal del formulario.
    await page.goto("/admin/cash/config");
    await expect(page.getByRole("region", { name: "Bancos" })).toBeVisible();

    const names = page.getByLabel(/^Nombre del banco \d+$/);
    let index = -1;

    // Idempotente: si el banco del E2E quedó de una corrida anterior (apagado, no borrado), se reusa.
    for (let position = 0; position < (await names.count()); position += 1) {
      if ((await names.nth(position).inputValue()) === BANK_NAME) {
        index = position;
        break;
      }
    }

    if (index === -1) {
      await page.getByRole("button", { name: "Agregar banco" }).click();
      index = (await names.count()) - 1;
      await names.nth(index).fill(BANK_NAME);
      await page.getByLabel(`Código ${index + 1} (opcional)`).fill("E2E");
    }

    await page.getByLabel(`${BANK_NAME} activo`).check();
    await page.getByLabel(new RegExp(`^${BANK_NAME} en `)).first().check();
    await page.getByRole("button", { name: "Guardar bancos" }).click();
    await expect(page.getByText("Bancos guardados.")).toBeVisible();

    // 2. La Caja: se abre el turno si hace falta y se lee su id para volver al detalle después.
    await page.goto("/admin/cash");
    const openButton = page.getByRole("button", { name: "Abrir caja" });
    const closeButton = page.getByRole("button", { name: "Cerrar caja" });

    // La pantalla resuelve primero el estado del turno (esqueleto): hay que esperar a que aparezca uno de
    // los dos botones antes de decidir, o el «abrir» se saltea y el cierre queda sobre una caja cerrada.
    await expect(openButton.or(closeButton).first()).toBeVisible();

    if (await openButton.isVisible()) {
      await openButton.click();
      await expect(closeButton).toBeVisible();
    }

    const shiftId = await page.evaluate(async () => {
      const locations = (await (await fetch("/api/admin/locations", { cache: "no-store" })).json())
        .data as { id: string }[];

      for (const location of locations) {
        const response = await fetch(
          `/api/admin/pos/shift?locationId=${encodeURIComponent(location.id)}`,
          { cache: "no-store" },
        );
        const open = (await response.json()).data;
        if (open) return open.id as string;
      }

      return null;
    });

    expect(shiftId, "hay una caja abierta (o se abrió una)").toBeTruthy();

    // 3. El cierre: el modal trae el conteo y el bloque del banco, con el cuadre a la vista antes de firmar.
    await closeButton.click();
    const dialog = page.getByRole("dialog");

    await expect(dialog.getByText("Cuadre por banco")).toBeVisible();
    await dialog.getByLabel(`Monto declarado de ${BANK_NAME}`).fill("500");
    await dialog.getByLabel(`Lote de ${BANK_NAME}`).fill(LOTE);
    await dialog.getByLabel(`Terminal de ${BANK_NAME}`).fill("Terminal E2E");

    // El consolidado y la diferencia son del dueño (audita el dinero): con el lote declarado ya hay número.
    await expect(dialog.getByText("Diferencia del cuadre")).toBeVisible();
    await expect(dialog.getByText(/El cierre no se bloquea por la diferencia/)).toBeVisible();

    await dialog.getByRole("button", { name: "Cerrar caja" }).click();

    // El cierre se firma por API: hay que esperarlo antes de ir al documento (si no, el detalle se lee
    // con el turno todavía abierto y el cuadre aparece vacío).
    await expect(page.getByText("Cierre registrado")).toBeVisible();

    // 4. El documento: el detalle del cierre guarda el cuadre y lo sigue diciendo.
    await page.goto(`/admin/cash/history/${shiftId}`);
    const bankSection = page.getByRole("region", { name: "Cuadre por banco" });

    await expect(bankSection).toBeVisible();
    await expect(bankSection.getByText(new RegExp(BANK_NAME))).toBeVisible();
    await expect(bankSection.getByText(new RegExp(`lote ${LOTE}`))).toBeVisible();
    await expect(bankSection.getByText("Diferencia de bancos")).toBeVisible();

    // 5. Y el catálogo se deja como estaba: el banco del E2E queda apagado (no se borra).
    await page.goto("/admin/cash/config");
    await page.getByLabel(`${BANK_NAME} activo`).uncheck();
    await page.getByRole("button", { name: "Guardar bancos" }).click();
    await expect(page.getByText("Bancos guardados.")).toBeVisible();
    await expect(page.getByLabel(`${BANK_NAME} activo`)).not.toBeChecked();
  });
});
