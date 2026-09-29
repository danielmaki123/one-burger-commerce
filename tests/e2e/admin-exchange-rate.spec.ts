import { expect, test, type Page } from "@playwright/test";

import { loginAsOwner } from "./helpers";

/**
 * `TASK-303a` + `TASK-MONEY-PAYMENTS-INTEGRATION-CLOSEOUT-002` (`A-84`, `A-87`, `D-016`) — **la tasa de
 * cambio del dólar, de punta a punta**.
 *
 * Es la tasa con la que el mostrador convierte un cobro en dólares. Si el guardado no llegara a la base, el
 * POS cobraría con una tasa vieja sin que nadie lo note: es la misma clase de bug que tuvo `paymentMethod` en
 * T11, cuando el adaptador de Prisma no escribía el campo y el unitario pasaba igual porque el adaptador en
 * memoria sí lo hacía. Por eso se verifica **contra la base**, recargando la pantalla.
 *
 * **Dónde vive ahora** (`A-84`): la tasa dejó de ser un campo de texto de Personalización y pasó a ser un
 * **hecho con fecha** en `/admin/finance` («Monedas y tasas» → «Tasa»), que es su autoridad (`D-018`).
 * Registrar una tasa **cierra** la vigente y agrega una fila: no se edita ni se borra, y ése es el contrato
 * que este spec ejercita —el campo viejo **pisaba** el valor—.
 *
 * Las tasas que registra son **propias de la corrida** (derivadas del reloj): la historia de tasas no se
 * borra, así que el spec tiene que ser repetible sin depender del número que dejó la corrida anterior.
 */
async function openCurrencies(page: Page) {
  await page.goto("/admin/finance");
  await page.getByRole("button", { name: /Monedas y tasas/ }).click();
}

async function registerRate(page: Page, code: string, value: string) {
  await openCurrencies(page);
  await page.getByRole("button", { name: `Guardar tasa de ${code}` }).click();
  await page.getByLabel(`Tasa (NIO por 1 ${code})`).fill(value);
  await page.getByRole("button", { name: "Guardar tasa", exact: true }).click();
  await expect(page.getByText("Tasa registrada.")).toBeVisible();
}

test.describe("tasa de cambio del dólar", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test("el owner la registra y queda vigente, sin pisar la anterior", async ({ page }) => {
    await loginAsOwner(page);

    // Dos valores propios de esta corrida, distintos entre sí: el segundo no puede ser el primero.
    const first = 40 + (Date.now() % 100) / 100;
    const second = first + 1.25;

    await registerRate(page, "USD", first.toFixed(2));

    await openCurrencies(page);
    await expect(page.getByText(`1 USD = ${first.toFixed(2)} NIO`)).toBeVisible();

    await registerRate(page, "USD", second.toFixed(2));

    // Registrar otra **crea historia**: la vigente es la nueva y la anterior deja de estarlo. Es la
    // diferencia con el campo de texto que había antes, donde la tasa simplemente se pisaba.
    await openCurrencies(page);
    await expect(page.getByText(`1 USD = ${second.toFixed(2)} NIO`)).toBeVisible();
    await expect(page.getByText(`1 USD = ${first.toFixed(2)} NIO`)).toBeHidden();

    /**
     * `A-87` — el formato regional se guarda **solo**, sin fingir un cambio de moneda base: antes el modal
     * llamaba a `changeBaseCurrency` con la base vigente y el dominio lo rechaza con `409` («ya es la moneda
     * base»), así que no guardaba nada.
     */
    await page.getByRole("button", { name: "Cambiar formato" }).click();
    await expect(page.getByLabel("Formato regional")).toBeVisible();
    await page.getByRole("button", { name: "Guardar formato" }).click();
    await expect(page.getByText("Formato actualizado.")).toBeVisible();
  });

  test("la tabla explica qué moneda no tiene tasa, en vez de inventar un número", async ({ page }) => {
    await loginAsOwner(page);

    await openCurrencies(page);

    // El euro está en el catálogo y no tiene tasa vigente: la tabla lo dice. Es la explicación que el dueño
    // necesita para saber qué le falta cargar (`A-83`: `missing-rate` se distingue de `unsupported-currency`).
    await expect(page.getByText("EUR", { exact: true })).toBeVisible();
    await expect(page.getByText("Sin tasa", { exact: true })).toBeVisible();
  });
});
