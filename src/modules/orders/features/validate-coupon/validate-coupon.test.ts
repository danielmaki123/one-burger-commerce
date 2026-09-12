import { describe, expect, it } from "vitest";

import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";

import { validateCoupon } from "./validate-coupon";

/**
 * T9b — el checkout pregunta si el código sirve antes de confirmar.
 *
 * Devuelve la forma pública del cupón (nunca el descuento en dinero) y usa los
 * mismos mensajes que saldrían al confirmar el pedido.
 */
function seedCoupon(repository: InMemoryOrderRepository, overrides: Record<string, unknown> = {}) {
  repository.coupons.push({
    id: "coupon_1",
    code: "B2G1",
    type: "bogo",
    value: 0,
    isActive: true,
    usageLimit: 0,
    usedCount: 0,
    expiresAt: null,
    buyQuantity: 2,
    freeQuantity: 1,
    scopeType: "category",
    scopeId: "cat_tacos",
    ...overrides,
  } as never);
}

describe("validateCoupon", () => {
  it("devuelve la forma pública de un código que sirve", async () => {
    const repository = new InMemoryOrderRepository();
    seedCoupon(repository);

    const result = await validateCoupon({ code: "b2g1" }, { repository });

    // El código se normaliza: el cliente no tiene que escribirlo en mayúsculas.
    expect(result.data).toEqual({
      code: "B2G1",
      type: "bogo",
      value: 0,
      buyQuantity: 2,
      freeQuantity: 1,
      scopeType: "category",
      scopeId: "cat_tacos",
    });
    // Nunca viaja un monto: el descuento lo calcula el servidor al crear el pedido.
    expect("discount" in result.data).toBe(false);
  });

  it("un código que no existe se rechaza con su mensaje", async () => {
    const repository = new InMemoryOrderRepository();

    await expect(validateCoupon({ code: "NOEXISTE" }, { repository })).rejects.toMatchObject({
      status: 404,
      message: "No encontramos ese código.",
    });
  });

  it("un código apagado, vencido o agotado se rechaza con el motivo", async () => {
    const now = new Date("2026-09-12T12:00:00.000Z");

    const apagado = new InMemoryOrderRepository();
    seedCoupon(apagado, { isActive: false });
    await expect(validateCoupon({ code: "B2G1" }, { repository: apagado, now })).rejects.toMatchObject(
      { status: 409, message: "Ese código ya no está activo." },
    );

    const vencido = new InMemoryOrderRepository();
    seedCoupon(vencido, { expiresAt: "2026-09-01T00:00:00.000Z" });
    await expect(validateCoupon({ code: "B2G1" }, { repository: vencido, now })).rejects.toMatchObject(
      { status: 409, message: "Ese código venció." },
    );

    const agotado = new InMemoryOrderRepository();
    seedCoupon(agotado, { usageLimit: 5, usedCount: 5 });
    await expect(validateCoupon({ code: "B2G1" }, { repository: agotado, now })).rejects.toMatchObject(
      { status: 409, message: "Ese código ya se usó todas las veces que se podía." },
    );
  });

  it("sin código no hay nada que validar", async () => {
    const repository = new InMemoryOrderRepository();

    await expect(validateCoupon({ code: "   " }, { repository })).rejects.toMatchObject({
      status: 400,
    });
  });
});
