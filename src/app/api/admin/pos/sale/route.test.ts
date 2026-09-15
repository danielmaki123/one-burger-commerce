import { beforeEach, describe, expect, it, vi } from "vitest";

import { AuthError } from "@/modules/auth/domain/auth-errors";
import type { OrderRecord } from "@/modules/orders/domain/order.types";
import { InMemoryPaymentRepository } from "@/modules/orders/adapters/in-memory-payment-repository";

/**
 * TASK-303b — la ruta del cobro.
 *
 * Lo que se prueba acá es la composición: cocina no cobra, un local fuera del alcance del staff no
 * se cobra, el payload se valida con el campo señalado y una venta válida devuelve el número, lo
 * cobrado y el cambio. El alta y los cobros corren de verdad (`registerPosSale`), con el alta
 * simulada: lo que se está probando es la ruta, no `createOrder` (que tiene sus propios tests).
 */

const requireAdminSessionMock = vi.fn();
const canUsePOSMock = vi.fn();
const createPosOrderMock = vi.fn();
const paymentRepository = new InMemoryPaymentRepository();

vi.mock("@/modules/auth/features/require-admin-session/require-admin-session", () => ({
  requireAdminSession: requireAdminSessionMock,
}));

vi.mock("@/modules/auth/domain/admin-permissions", () => ({
  canUsePOS: canUsePOSMock,
}));

vi.mock("@/modules/pos/adapters/production-pos-sale", () => ({
  createProductionPosSaleDependencies: async () => ({
    createPosOrder: createPosOrderMock,
    paymentRepository,
    businessCurrencyCode: "NIO",
    usdExchangeRate: 36.5,
  }),
}));

const venta = {
  locationId: "loc_norte",
  customer: { name: "Cliente Mostrador", whatsapp: "88887777", email: "cliente@ejemplo.com" },
  lines: [
    {
      productId: "prod_taco",
      name: "Taco de birria",
      unitPrice: 35,
      packagingUnitAmount: 5,
      quantity: 2,
    },
  ],
  payments: [{ method: "cash" as const, currency: "NIO", amount: 80 }],
};

async function callRoute(body: unknown) {
  const { POST } = await import("./route");

  return POST(
    new Request("http://localhost/api/admin/pos/sale", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  );
}

describe("admin pos sale route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_1", role: "cashier", locationIds: [] },
    });
    canUsePOSMock.mockReturnValue(true);
    createPosOrderMock.mockResolvedValue({
      id: "ord_01",
      orderNumber: "P-ABC123",
      total: 80,
    } as OrderRecord);
  });

  it("sin sesión responde 401", async () => {
    requireAdminSessionMock.mockRejectedValue(new AuthError(401, "UNAUTHORIZED", "No session"));

    const response = await callRoute(venta);

    expect(response.status).toBe(401);
    expect(createPosOrderMock).not.toHaveBeenCalled();
  });

  it("cocina no cobra: 403", async () => {
    canUsePOSMock.mockReturnValue(false);

    const response = await callRoute(venta);

    expect(response.status).toBe(403);
    expect(createPosOrderMock).not.toHaveBeenCalled();
  });

  it("un local fuera del alcance del staff responde 403", async () => {
    requireAdminSessionMock.mockResolvedValue({
      user: { id: "admin_2", role: "cashier", locationIds: ["loc_sur"] },
    });

    const response = await callRoute(venta);
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.error.fields.locationId).toContain("acceso");
    expect(createPosOrderMock).not.toHaveBeenCalled();
  });

  it("un payload sin cobros responde 422 con el campo señalado", async () => {
    const response = await callRoute({ ...venta, payments: [] });
    const body = await response.json();

    expect(response.status).toBe(422);
    expect(body.error.fields.payments).toContain("cobro");
    expect(createPosOrderMock).not.toHaveBeenCalled();
  });

  it("una venta válida devuelve número, total, cobrado y cambio", async () => {
    const response = await callRoute({
      ...venta,
      payments: [{ method: "cash", currency: "NIO", amount: 100 }],
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data).toMatchObject({
      orderId: "ord_01",
      orderNumber: "P-ABC123",
      total: 80,
      paid: 100,
      change: 20,
    });
    expect(body.data.payments).toHaveLength(1);
    expect(body.data.payments[0]).toMatchObject({ method: "cash", amount: 100, currency: "NIO" });
    expect(createPosOrderMock).toHaveBeenCalledWith(
      expect.objectContaining({
        type: "pickup",
        customerEmail: "cliente@ejemplo.com",
        items: [{ productId: "prod_taco", quantity: 2, modifierOptionIds: [], notes: null }],
      }),
    );
  });

  it("un cobro en dólares se registra con su moneda", async () => {
    const response = await callRoute({
      ...venta,
      payments: [{ method: "cash", currency: "usd", amount: 3 }],
    });
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.data.payments[0].currency).toBe("USD");
    // 3 × 36.5 = 109.50 contra un total de 80.
    expect(body.data.change).toBe(29.5);
  });
});
