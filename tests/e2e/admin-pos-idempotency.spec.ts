import { expect, test } from "@playwright/test";

import { loginAsOwner, mutationsAllowed } from "./helpers";

/**
 * Tarea 11 del brief (2026-09-17) — **el cobro offline reintentado no cobra dos veces** (12.1/12.2).
 *
 * El caso reproduce lo que pasa en el mostrador cuando se corta la red justo después de mandar el cobro:
 * el mismo request —**misma clave de intento**, el UUID que viaja con el borrador— se manda dos veces.
 *
 * La prueba no se queda en el código de estado: comprueba la **plata**. El corte X (tarea 7) dice cuánto
 * espera el sistema en el cajón, y ese número sale de los cobros del turno: después del reintento tiene
 * que ser **el mismo** que después del primer cobro. Si los cobros se registraran dos veces, el arqueo
 * contaría la venta dos veces y el cierre marcaría una diferencia que nadie se explica.
 */

test.describe("cobro reintentado (idempotencia del UUID)", () => {
  test("el reintento del mismo cobro no registra un segundo pago en el arqueo", async ({ page }) => {
    test.skip(!mutationsAllowed, "Order creation is disabled unless E2E_ALLOW_MUTATIONS=true.");

    await loginAsOwner(page);

    const contexto = await page.evaluate(async () => {
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

        const corte = (
          await (
            await fetch(`/api/admin/pos/shift/x?locationId=${encodeURIComponent(location.id)}`, {
              cache: "no-store",
            })
          ).json()
        ).data as { expectedAmount: number } | null;

        return {
          locationId: location.id,
          product,
          amount: product.basePrice + product.packagingFeeAmount,
          expectedBefore: corte?.expectedAmount ?? null,
        };
      }

      return null;
    });

    expect(contexto, "hay un local con mostrador, catálogo y caja abierta").toBeTruthy();

    const { locationId, product, amount, expectedBefore } = contexto!;
    const idempotencyKey = `e2e-idem-${Date.now()}`;

    const body = (extra: { paidWith: number }) => ({
      locationId,
      customer: { name: "Cliente reintento", whatsapp: "88881111" },
      lines: [
        {
          productId: product.id,
          name: product.name,
          unitPrice: product.basePrice,
          packagingUnitAmount: product.packagingFeeAmount ?? 0,
          quantity: 1,
        },
      ],
      payments: [{ method: "cash", currency: "NIO", amount: extra.paidWith }],
      idempotencyKey,
    });

    const primero = await page.evaluate(
      async (payload) => {
        const response = await fetch("/api/admin/pos/sale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        return { status: response.status, body: await response.json() };
      },
      body({ paidWith: amount }),
    );

    expect(primero.status, JSON.stringify(primero.body)).toBe(201);
    expect(primero.body.data.reused).toBe(false);

    const despuesDelPrimero = await page.evaluate(async (id) => {
      const corte = (
        await (
          await fetch(`/api/admin/pos/shift/x?locationId=${encodeURIComponent(id)}`, {
            cache: "no-store",
          })
        ).json()
      ).data as { expectedAmount: number; cashSalesAmount: number };

      return corte;
    }, locationId);

    // El cobro entró al arqueo: el esperado subió exactamente lo que se cobró.
    if (expectedBefore !== null) {
      expect(despuesDelPrimero.expectedAmount).toBe(Math.round((expectedBefore + amount) * 100) / 100);
    }

    // El reintento del mismo intento: misma clave, misma venta, sin cobrar otra vez.
    const reintento = await page.evaluate(
      async (payload) => {
        const response = await fetch("/api/admin/pos/sale", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        return { status: response.status, body: await response.json() };
      },
      body({ paidWith: amount }),
    );

    expect(reintento.status, JSON.stringify(reintento.body)).toBe(200);
    expect(reintento.body.data.reused).toBe(true);
    expect(reintento.body.data.orderNumber).toBe(primero.body.data.orderNumber);

    const despuesDelReintento = await page.evaluate(async (id) => {
      const corte = (
        await (
          await fetch(`/api/admin/pos/shift/x?locationId=${encodeURIComponent(id)}`, {
            cache: "no-store",
          })
        ).json()
      ).data as { expectedAmount: number; cashSalesAmount: number };

      return corte;
    }, locationId);

    expect(despuesDelReintento.expectedAmount).toBe(despuesDelPrimero.expectedAmount);
    expect(despuesDelReintento.cashSalesAmount).toBe(despuesDelPrimero.cashSalesAmount);
  });
});
