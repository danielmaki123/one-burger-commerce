import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";
import { createPromotion } from "@/modules/orders/features/create-promotion/create-promotion";
import { updatePromotion } from "./update-promotion";

/**
 * T9c — el owner edita una promo.
 *
 * Regla de oro: editar **no** reinicia el uso acumulado. Si una promo ya se usó 3
 * veces y el owner le cambia el texto, sigue llevando 3.
 */
const base = {
  code: "B2G1",
  type: "bogo" as const,
  value: 0,
  isActive: true,
  usageLimit: 0,
  expiresAt: null,
  buyQuantity: 2,
  freeQuantity: 1,
  scopeType: "all",
  scopeId: null,
};

describe("updatePromotion", () => {
  let repository: InMemoryOrderRepository;

  beforeEach(() => {
    repository = new InMemoryOrderRepository();
  });

  it("no encuentra una promo que no existe", async () => {
    await expect(updatePromotion("coupon_99", base, { repository })).rejects.toMatchObject({
      status: 404,
    });
  });

  it("cambia los datos y no pierde el uso acumulado", async () => {
    const { data: created } = await createPromotion({ ...base, usageLimit: 5 }, { repository });
    await repository.consumeCouponUsage(created.id, 5);

    const { data } = await updatePromotion(
      created.id,
      { ...base, code: "b2g1-viernes", buyQuantity: 3, freeQuantity: 1, usageLimit: 10 },
      { repository },
    );

    expect(data.code).toBe("B2G1-VIERNES");
    expect(data.buyQuantity).toBe(3);
    expect(data.usageLimit).toBe(10);
    expect(data.usedCount).toBe(1);
  });

  it("puede cambiar el tipo de promo sin arrastrar los campos del tipo anterior", async () => {
    const { data: created } = await createPromotion(
      { ...base, scopeType: "category", scopeId: "cat_tacos" },
      { repository },
    );

    const { data } = await updatePromotion(
      created.id,
      { ...base, type: "percentage", value: 15, buyQuantity: 2, freeQuantity: 1 },
      { repository },
    );

    expect(data.type).toBe("percentage");
    expect(data.value).toBe(15);
    expect(data.scopeType).toBe("all");
    expect(data.scopeId).toBeNull();
    expect(data.buyQuantity).toBeNull();
  });

  it("rechaza datos mal armados sin tocar lo guardado", async () => {
    const { data: created } = await createPromotion({ ...base }, { repository });

    await expect(
      updatePromotion(created.id, { ...base, freeQuantity: 0 }, { repository }),
    ).rejects.toMatchObject({ status: 422, fields: { freeQuantity: expect.stringContaining("gratis") } });

    const stillThere = await repository.findCouponById(created.id);
    expect(stillThere?.freeQuantity).toBe(1);
  });

  it("no deja robarle el código a otra promo", async () => {
    await createPromotion({ ...base, code: "TACOS" }, { repository });
    const { data: otra } = await createPromotion({ ...base, code: "BURGER" }, { repository });

    await expect(
      updatePromotion(otra.id, { ...base, code: "tacos" }, { repository }),
    ).rejects.toMatchObject({ status: 409, fields: { code: expect.stringContaining("TACOS") } });
  });

  it("puede guardar sin cambiar el código", async () => {
    const { data: created } = await createPromotion({ ...base, code: "TACOS" }, { repository });

    const { data } = await updatePromotion(
      created.id,
      { ...base, code: "TACOS", isActive: false },
      { repository },
    );

    expect(data.isActive).toBe(false);
  });
});
