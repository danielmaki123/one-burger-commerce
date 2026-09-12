import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";
import { createPromotion } from "@/modules/orders/features/create-promotion/create-promotion";
import { listPromotions } from "./list-promotions";

/**
 * T9c — la lista del admin.
 *
 * Se muestra el estado real de cada promo (`activa`, `vencida`, `agotada`), que es lo
 * que el owner necesita para decidir si la toca.
 */
const base = {
  type: "percentage" as const,
  value: 10,
  isActive: true,
  usageLimit: 0,
  expiresAt: null,
  buyQuantity: null,
  freeQuantity: null,
  scopeType: "all",
  scopeId: null,
};

describe("listPromotions", () => {
  let repository: InMemoryOrderRepository;

  beforeEach(() => {
    repository = new InMemoryOrderRepository();
  });

  it("sin promos devuelve una lista vacía, no un error", async () => {
    const { data } = await listPromotions({ repository });

    expect(data).toEqual([]);
  });

  it("lista todas las promos con su estado calculado", async () => {
    await createPromotion({ ...base, code: "TACOS", value: 10 }, { repository });
    await createPromotion(
      { ...base, code: "VIEJA", value: 20, expiresAt: "2020-01-01" },
      { repository, timeZone: "UTC" },
    );
    await createPromotion(
      { ...base, code: "APAGADA", value: 30, isActive: false },
      { repository },
    );
    const { data: agotada } = await createPromotion(
      { ...base, code: "AGOTADA", value: 40, usageLimit: 1 },
      { repository },
    );
    await repository.consumeCouponUsage(agotada.id, 1);

    const { data } = await listPromotions({ repository });
    const byCode = Object.fromEntries(data.map((promo) => [promo.code, promo.status]));

    expect(data).toHaveLength(4);
    expect(byCode).toEqual({
      TACOS: "active",
      VIEJA: "expired",
      APAGADA: "inactive",
      AGOTADA: "exhausted",
    });
  });

  it("las promos agotadas se cuentan por el uso real, no por lo que dice el límite", async () => {
    // `usageLimit: 0` es "sin límite": mientras nadie la use no puede figurar agotada.
    await createPromotion({ ...base, code: "SIN-TOPE" }, { repository });

    const { data } = await listPromotions({ repository });

    expect(data[0].status).toBe("active");
    expect(data[0].usedCount).toBe(0);
  });
});
