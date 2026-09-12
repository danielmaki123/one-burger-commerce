import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";
import { createPromotion } from "@/modules/orders/features/create-promotion/create-promotion";
import { deletePromotion } from "./delete-promotion";

/**
 * T9c — el owner borra una promo.
 *
 * Borrar de verdad (y no "desactivar") es lo que el mock muestra con el tacho. Para
 * dejar de ofrecerla un tiempo está el interruptor de activa.
 */
describe("deletePromotion", () => {
  let repository: InMemoryOrderRepository;

  beforeEach(() => {
    repository = new InMemoryOrderRepository();
  });

  it("borra la promo", async () => {
    const { data: created } = await createPromotion(
      {
        code: "TACOS",
        type: "percentage",
        value: 10,
        isActive: true,
        usageLimit: 0,
        expiresAt: null,
        buyQuantity: null,
        freeQuantity: null,
        scopeType: "all",
        scopeId: null,
      },
      { repository },
    );

    await deletePromotion(created.id, { repository });

    expect(await repository.findCouponById(created.id)).toBeNull();
    expect(await repository.listCoupons()).toHaveLength(0);
  });

  it("no falla en silencio si la promo ya no está", async () => {
    await expect(deletePromotion("coupon_99", { repository })).rejects.toMatchObject({
      status: 404,
    });
  });
});
