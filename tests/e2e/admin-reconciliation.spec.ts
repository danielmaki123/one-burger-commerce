import { expect, test } from "@playwright/test";

import { loginAsOwner, mutationsAllowed } from "./helpers";

/**
 * Tarea 10 del brief (2026-09-17) — la **conciliación de tarjeta y transferencia** (11.1/11.2).
 *
 * El caso cobra una venta **con tarjeta** de verdad (por API, como el retiro del spec de caja) porque la
 * pantalla solo ofrece el export cuando hubo cobros de esas dos vías: sin un cobro propio, el test
 * dependería de que la base local ya tuviera uno. Después verifica el camino completo en el navegador
 * —los totales que muestra y el CSV que baja, con la **referencia** del voucher adentro, que es lo que se
 * busca en el lote de la terminal—.
 */

/** Una venta cobrada con tarjeta: devuelve el número de pedido y la referencia del voucher. */
async function sellWithCard(page: import("@playwright/test").Page) {
  return page.evaluate(async () => {
    const locations = (await (await fetch("/api/admin/locations", { cache: "no-store" })).json())
      .data as { id: string; posEnabled: boolean }[];

    for (const location of locations) {
      if (!location.posEnabled) continue;

      const open = (
        await (
          await fetch(`/api/admin/pos/shift?locationId=${encodeURIComponent(location.id)}`, {
            cache: "no-store",
          })
        ).json()
      ).data;

      // Cobrar exige caja abierta (Bloque 9.2): se abre con el conteo vacío.
      if (!open) {
        const created = await fetch("/api/admin/pos/shift/open", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ locationId: location.id, counts: [] }),
        });

        if (!created.ok) continue;
      }

      const catalog = (
        await (
          await fetch(`/api/admin/pos/catalog?locationId=${encodeURIComponent(location.id)}`, {
            cache: "no-store",
          })
        ).json()
      ).data as {
        products: {
          id: string;
          name: string;
          basePrice: number;
          packagingFeeAmount: number;
          requiresOptions: boolean;
          availability: { isAvailable: boolean; isActive: boolean };
        }[];
      };

      // El catálogo del mostrador incluye los agotados (para poder avisarlos): un caso que cobra de
      // verdad tiene que elegir uno **vendible**, o el alta lo rechaza con 409.
      const product = catalog.products.find(
        (candidate) => !candidate.requiresOptions && candidate.availability.isAvailable,
      );
      if (!product) continue;

      const reference = `E2E-TARJETA-${Date.now()}`;
      const response = await fetch("/api/admin/pos/sale", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          locationId: location.id,
          customer: { name: "Cliente conciliación", whatsapp: "88889999" },
          lines: [
            {
              productId: product.id,
              name: product.name,
              unitPrice: product.basePrice,
              packagingUnitAmount: product.packagingFeeAmount,
              quantity: 1,
            },
          ],
          payments: [
            {
              method: "card",
              currency: "NIO",
              amount: product.basePrice + product.packagingFeeAmount,
              reference,
            },
          ],
        }),
      });

      return {
        status: response.status,
        body: await response.json(),
        locationId: location.id,
        reference,
        amount: product.basePrice + product.packagingFeeAmount,
      };
    }

    return null;
  });
}

test.describe("conciliación de tarjeta y transferencia", () => {
  test("muestra lo cobrado con tarjeta y baja el CSV con la referencia del voucher", async ({
    page,
  }) => {
    test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);

    const sale = await sellWithCard(page);
    expect(sale, "hay un local con mostrador y catálogo para cobrar").toBeTruthy();
    expect(sale!.status, JSON.stringify(sale!.body)).toBe(201);

    await page.goto("/admin/cash");
    const panel = page.getByRole("region", { name: "Conciliación de tarjeta y transferencia" });
    await expect(panel).toBeVisible();

    // 375 px: el panel nuevo no puede meter scroll horizontal (regla del sistema).
    await page.setViewportSize({ width: 375, height: 812 });
    expect(
      await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      ),
    ).toBeLessThanOrEqual(1);
    await page.setViewportSize({ width: 1280, height: 900 });

    // La fila de tarjeta cuenta al menos el cobro que se acaba de hacer (la base local acumula corridas).
    await expect(panel.getByRole("button", { name: "Descargar CSV" })).toBeVisible();
    const filaTarjeta = panel.getByRole("listitem").filter({ hasText: "Tarjeta" }).first();
    await expect(filaTarjeta).toBeVisible();
    expect(await filaTarjeta.textContent()).toMatch(/\d+ cobros?/);

    const descarga = page.waitForEvent("download");
    await panel.getByRole("button", { name: "Descargar CSV" }).click();
    const archivo = await descarga;

    expect(archivo.suggestedFilename()).toMatch(/^conciliacion-.+-\d{4}-\d{2}-\d{2}\.csv$/);
    // El contenido importa más que el nombre: es la fila que se busca en el lote de la terminal.
    const csv = await archivo.createReadStream();
    const trozos: Buffer[] = [];
    for await (const trozo of csv) trozos.push(Buffer.from(trozo));
    const texto = Buffer.concat(trozos).toString("utf8");

    expect(texto.split("\r\n")[0]).toBe("Fecha;Local;Pedido;Medio;Monto;Moneda;Referencia");
    expect(texto).toContain(sale!.reference);
    expect(texto).toContain("Tarjeta");
    expect(texto).toContain("NIO");
  });
});
