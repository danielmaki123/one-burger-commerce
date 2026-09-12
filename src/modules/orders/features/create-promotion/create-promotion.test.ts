import { beforeEach, describe, expect, it } from "vitest";

import { InMemoryOrderRepository } from "@/modules/orders/adapters/in-memory-order-repository";
import { createPromotion } from "./create-promotion";

/**
 * T9c — el owner crea una promo desde el admin.
 *
 * El caso de uso valida con las mismas reglas que muestra el formulario: si algo
 * entra por la API sin pasar por la pantalla, se rechaza igual.
 */
const base = {
  code: "b2g1",
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

describe("createPromotion", () => {
  let repository: InMemoryOrderRepository;

  beforeEach(() => {
    repository = new InMemoryOrderRepository();
  });

  it("guarda el código como lo va a escribir el cliente: mayúsculas", async () => {
    const { data } = await createPromotion({ ...base, code: "  b2g1  " }, { repository });

    expect(data.code).toBe("B2G1");
    expect(data.type).toBe("bogo");
    expect(data.buyQuantity).toBe(2);
    expect(data.freeQuantity).toBe(1);
    expect(data.usedCount).toBe(0);
    expect(data.isActive).toBe(true);
  });

  it("rechaza una promo mal armada campo por campo", async () => {
    // Los campos son los que el formulario del admin necesita para marcar el input.
    await expect(createPromotion({ ...base, code: "AB" }, { repository })).rejects.toMatchObject({
      status: 422,
      fields: { code: expect.stringContaining("3") },
    });

    await expect(
      createPromotion({ ...base, buyQuantity: null }, { repository }),
    ).rejects.toMatchObject({
      status: 422,
      fields: { buyQuantity: expect.stringContaining("llevar") },
    });
  });

  it("no deja dos promos con el mismo código", async () => {
    await createPromotion({ ...base, code: "TACOS" }, { repository });

    await expect(createPromotion({ ...base, code: " tacos " }, { repository })).rejects.toMatchObject(
      { status: 409, fields: { code: expect.stringContaining("TACOS") } },
    );
  });

  it("un porcentaje no arrastra las unidades de una promo por cantidad", async () => {
    const { data } = await createPromotion(
      {
        ...base,
        code: "VERANO",
        type: "percentage",
        value: 10,
        buyQuantity: 2,
        freeQuantity: 1,
      },
      { repository },
    );

    // El descuento de un porcentaje no mira las unidades: guardarlas haría que la
    // pantalla del admin muestre algo que la promo no hace.
    expect(data.scopeType).toBe("all");
    expect(data.scopeId).toBeNull();
    expect(data.buyQuantity).toBeNull();
    expect(data.freeQuantity).toBeNull();
  });

  it("no acepta un alcance en una promo que no sea por cantidad", async () => {
    // El formulario esconde el alcance fuera de "por cantidad"; si igual llega, se rechaza.
    await expect(
      createPromotion(
        { ...base, code: "VERANO", type: "percentage", value: 10, scopeType: "category", scopeId: "cat_tacos" },
        { repository },
      ),
    ).rejects.toMatchObject({
      status: 422,
      fields: { scopeType: expect.stringContaining("cantidad") },
    });
  });

  it("una promo por cantidad guarda a qué alcanza y no arrastra un monto", async () => {
    const { data } = await createPromotion(
      {
        ...base,
        code: "TACOS2X1",
        value: 500,
        scopeType: "category",
        scopeId: "cat_tacos",
      },
      { repository },
    );

    expect(data.value).toBe(0);
    expect(data.scopeType).toBe("category");
    expect(data.scopeId).toBe("cat_tacos");
  });

  it("la fecha de vencimiento cubre el día entero en la zona del negocio", async () => {
    // El formulario manda `2026-12-31` (lo que da un input date).
    const { data } = await createPromotion(
      { ...base, code: "NAVIDAD", expiresAt: "2026-12-31" },
      { repository, timeZone: "America/Managua" },
    );

    expect(data.expiresAt).toBe("2027-01-01T05:59:59.999Z");
  });

  it("sin fecha de vencimiento la promo no vence", async () => {
    const { data } = await createPromotion({ ...base, code: "SIEMPRE" }, { repository });

    expect(data.expiresAt).toBeNull();
  });
});
